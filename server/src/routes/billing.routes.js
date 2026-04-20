import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { stripe, requireStripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { roleAtLeast } from '../middleware/org.js';
import { billingLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, HttpError } from '../utils/async.js';

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

// Billing routes receive orgId in the body (not a URL param), so the
// standard requireOrgRole helper — which reads from req.params — doesn't
// fit. This is the same membership check with the orgId already known.
async function assertOrgAdmin(userId, orgId) {
  if (!orgId) throw new HttpError(400, 'Missing orgId');
  const { data: membership, error } = await supabase
    .from('org_members')
    .select('role, accepted_at')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!membership || !membership.accepted_at) {
    throw new HttpError(403, 'Not a member of this organization');
  }
  if (!roleAtLeast(membership.role, 'admin')) {
    throw new HttpError(403, 'Requires role admin or higher');
  }
  return membership;
}

// Ensures an org has a Stripe customer on file, creating one if not.
// Updates the org_subscriptions row in place so the id persists across
// calls (Checkout + Portal both need the same customer).
async function ensureStripeCustomer({ orgId, subscription }) {
  if (subscription.stripe_customer_id) return subscription.stripe_customer_id;

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, support_email, billing_address')
    .eq('id', orgId)
    .maybeSingle();

  const customer = await stripe.customers.create({
    name: org?.name ?? undefined,
    email: org?.support_email ?? undefined,
    metadata: { org_id: orgId },
  });

  const { error } = await supabase
    .from('org_subscriptions')
    .update({ stripe_customer_id: customer.id })
    .eq('org_id', orgId);
  if (error) throw error;

  return customer.id;
}

async function loadOrgSubscription(orgId) {
  const { data, error } = await supabase
    .from('org_subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Organization has no subscription row');
  return data;
}

// Stripe status → our internal enum. Anything unrecognized falls through
// to 'active' to avoid accidental downgrades on new Stripe states.
function mapStripeStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return stripeStatus === 'trialing' ? 'trialing' : 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    default:
      return 'active';
  }
}

// ---------------------------------------------------------------------
// Checkout + Portal routes (JSON body; rate-limited; auth-gated).
// The webhook is mounted separately in index.js because it needs the raw
// body for signature verification.
// ---------------------------------------------------------------------

export const billingRouter = Router();

billingRouter.use(requireAuth);
billingRouter.use(billingLimiter);

const subscriptionCheckoutSchema = z.object({
  orgId: z.string().uuid(),
});

billingRouter.post(
  '/checkout/subscription',
  asyncHandler(async (req, res) => {
    const { orgId } = subscriptionCheckoutSchema.parse(req.body ?? {});
    await assertOrgAdmin(req.user.id, orgId);
    requireStripe();

    const sub = await loadOrgSubscription(orgId);

    const { data: plan, error: planErr } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', sub.plan_slug)
      .maybeSingle();
    if (planErr) throw planErr;

    if (plan?.slug === 'pro' && sub.status === 'active') {
      throw new HttpError(400, 'Already on Pro');
    }

    const { data: proPlan, error: proErr } = await supabase
      .from('subscription_plans')
      .select('stripe_price_id')
      .eq('slug', 'pro')
      .maybeSingle();
    if (proErr) throw proErr;

    const priceId = proPlan?.stripe_price_id || env.stripePriceIdPro;
    if (!priceId) {
      throw new HttpError(503, 'Pro plan is missing a Stripe price. Contact support.');
    }

    const customerId = await ensureStripeCustomer({ orgId, subscription: sub });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      client_reference_id: orgId,
      metadata: { org_id: orgId, product: 'subscription', plan_slug: 'pro' },
      success_url: `${env.appUrl}/dashboard/plan?billing=success`,
      cancel_url:  `${env.appUrl}/dashboard/plan?billing=cancel`,
    });

    res.json({ url: session.url });
  }),
);

const addonCheckoutSchema = z.object({
  orgId: z.string().uuid(),
  addonSlug: z.string().trim().min(1).max(80),
  productId: z.string().uuid().optional(),
});

billingRouter.post(
  '/checkout/addon',
  asyncHandler(async (req, res) => {
    const { orgId, addonSlug, productId } = addonCheckoutSchema.parse(req.body ?? {});
    await assertOrgAdmin(req.user.id, orgId);
    requireStripe();

    const { data: addon, error: addonErr } = await supabase
      .from('addon_services')
      .select('*')
      .eq('slug', addonSlug)
      .eq('active', true)
      .maybeSingle();
    if (addonErr) throw addonErr;
    if (!addon) throw new HttpError(404, 'Unknown add-on');

    // Price ID resolution: prefer the row-level override, fall back to env
    // for the default add-on so early setups work without a DB edit.
    let priceId = addon.stripe_price_id || '';
    if (!priceId && addonSlug === 'homepage-feature') {
      priceId = env.stripePriceIdHomepageFeature;
    }
    if (!priceId) {
      throw new HttpError(503, `Add-on "${addonSlug}" is missing a Stripe price. Contact support.`);
    }

    // Homepage feature must target a specific listing the org owns. We
    // don't fail on addon_slug mismatch here — just validate when asked.
    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('id, org_id')
        .eq('id', productId)
        .maybeSingle();
      if (!product || product.org_id !== orgId) {
        throw new HttpError(400, 'Selected listing does not belong to this organization');
      }
    }

    const sub = await loadOrgSubscription(orgId);
    const customerId = await ensureStripeCustomer({ orgId, subscription: sub });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      client_reference_id: orgId,
      metadata: {
        org_id: orgId,
        product: 'addon',
        addon_slug: addonSlug,
        product_id: productId ?? '',
      },
      success_url: `${env.appUrl}/dashboard/plan?billing=success`,
      cancel_url:  `${env.appUrl}/dashboard/plan?billing=cancel`,
    });

    res.json({ url: session.url });
  }),
);

const portalSchema = z.object({ orgId: z.string().uuid() });

billingRouter.post(
  '/portal',
  asyncHandler(async (req, res) => {
    const { orgId } = portalSchema.parse(req.body ?? {});
    await assertOrgAdmin(req.user.id, orgId);
    requireStripe();

    const sub = await loadOrgSubscription(orgId);
    if (!sub.stripe_customer_id) {
      throw new HttpError(409, 'No billing profile yet. Complete a checkout first.');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${env.appUrl}/dashboard/plan`,
    });

    res.json({ url: session.url });
  }),
);

// ---------------------------------------------------------------------
// Webhook handler — exported separately so index.js can mount it BEFORE
// express.json(). It receives `req.body` as a raw Buffer.
// ---------------------------------------------------------------------

export async function webhookHandler(req, res) {
  if (!stripe || !env.stripeWebhookSecret) {
    // Don't 5xx — Stripe will retry indefinitely. A 503 is the "we're not
    // configured" signal; the Dashboard surface marks it as a failure the
    // operator needs to fix rather than a transient error.
    res.status(503).json({ message: 'Billing is not configured on this server' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch (err) {
    console.warn('[billing] webhook signature verification failed', err?.message);
    res.status(400).json({ message: 'Invalid signature' });
    return;
  }

  // Idempotency: record the event id before processing. If the row
  // already exists (unique PK), treat this delivery as a duplicate.
  // Using INSERT + capturing the 23505 conflict is cleaner than a SELECT
  // first because it closes the race between two concurrent deliveries.
  const insertRes = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })
    .select('id');

  if (insertRes.error) {
    // 23505 = unique_violation on primary key → we've already processed.
    if (insertRes.error.code === '23505') {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
    console.error('[billing] failed to log stripe event', insertRes.error);
    // Fall through and still try to dispatch — better duplicate-processed
    // than dropped. Stripe handlers below are mostly idempotent.
  }

  try {
    await dispatchWebhookEvent(event);
  } catch (err) {
    // Swallow + log: returning 5xx would make Stripe retry forever on
    // poison-pill events. Operator sees the error in Render logs instead.
    console.error('[billing] webhook handler error', event.type, err);
  }

  res.status(200).json({ received: true });
}

async function dispatchWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;
    default:
      // Ignore unrecognized events — we only subscribed to four, but the
      // dashboard may send more if the endpoint is reused.
      break;
  }
}

async function handleCheckoutSessionCompleted(session) {
  const metadata = session.metadata ?? {};
  const orgId = metadata.org_id;
  if (!orgId) {
    console.warn('[billing] checkout.session.completed missing org_id metadata');
    return;
  }

  if (metadata.product === 'subscription') {
    const patch = {
      plan_slug: 'pro',
      status: 'active',
      started_at: new Date().toISOString(),
      stripe_customer_id: session.customer ?? null,
      stripe_subscription_id: session.subscription ?? null,
      cancel_at_period_end: false,
    };
    const { error } = await supabase
      .from('org_subscriptions')
      .update(patch)
      .eq('org_id', orgId);
    if (error) throw error;
    return;
  }

  if (metadata.product === 'addon' && metadata.addon_slug === 'homepage-feature') {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from('org_addons').insert({
      org_id: orgId,
      addon_slug: 'homepage-feature',
      product_id: metadata.product_id || null,
      status: 'active',
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      stripe_payment_intent_id: session.payment_intent ?? null,
    });
    if (error) throw error;
  }
}

async function handleSubscriptionUpdated(subscription) {
  const { data: row } = await supabase
    .from('org_subscriptions')
    .select('org_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();
  if (!row) return;

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from('org_subscriptions')
    .update({
      status: mapStripeStatus(subscription.status),
      current_period_end: periodEnd,
      cancel_at_period_end: !!subscription.cancel_at_period_end,
    })
    .eq('org_id', row.org_id);
  if (error) throw error;
}

async function handleSubscriptionDeleted(subscription) {
  const { data: row } = await supabase
    .from('org_subscriptions')
    .select('org_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();
  if (!row) return;

  const { error } = await supabase
    .from('org_subscriptions')
    .update({
      status: 'cancelled',
      plan_slug: 'free',
      cancel_at_period_end: false,
      stripe_subscription_id: null,
    })
    .eq('org_id', row.org_id);
  if (error) throw error;
}

async function handleInvoicePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;
  const { data: row } = await supabase
    .from('org_subscriptions')
    .select('org_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!row) return;

  const { error } = await supabase
    .from('org_subscriptions')
    .update({ status: 'past_due' })
    .eq('org_id', row.org_id);
  if (error) throw error;
}

export default billingRouter;
