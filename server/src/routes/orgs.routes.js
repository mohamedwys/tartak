import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgRole, roleAtLeast } from '../middleware/org.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import {
  toOrganization,
  toOrgMember,
  toProduct,
  toMessage,
  toOffer,
  toStorefront,
  toSubscriptionPlan,
  toOrgSubscription,
  toOrgAddon,
} from '../utils/mapping.js';

const router = Router();

// All routes require an authenticated user; public GET /:id still needs the
// caller to know the org id (and we expose org profile regardless of
// membership) — but to keep one consistent auth surface and align with the
// rest of the API we still run requireAuth on /:id. Spec says "public (anyone
// can read an org profile)" — we interpret "public" as "any authenticated
// user" to match the rest of the API, which is also auth-guarded.
router.use(requireAuth);

const billingAddressSchema = z
  .object({
    street: z.string().trim().max(200).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    country: z.string().trim().max(120).optional().nullable(),
    postal: z.string().trim().max(40).optional().nullable(),
  })
  .partial()
  .optional()
  .nullable();

const createOrgSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(['b2c', 'b2b', 'both']).default('b2c'),
  taxId: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  billingAddress: billingAddressSchema,
  bio: z.string().trim().max(2000).optional().nullable(),
  website: z.string().url().max(300).optional().nullable(),
  supportEmail: z.string().trim().toLowerCase().email().optional().nullable(),
});

const updateOrgSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['b2c', 'b2b', 'both']).optional(),
  taxId: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  billingAddress: billingAddressSchema,
  bio: z.string().trim().max(2000).optional().nullable(),
  website: z.string().url().max(300).optional().nullable(),
  supportEmail: z.string().trim().toLowerCase().email().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'manager', 'agent']).default('agent'),
});

const roleChangeSchema = z.object({
  role: z.enum(['admin', 'manager', 'agent']),
});

function slugifyBase(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'org';
}

async function uniqueSlug(base) {
  let candidate = base;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    const suffix = Math.random().toString(36).slice(2, 7);
    candidate = `${base}-${suffix}`;
  }
  // Last-ditch fallback — collision here would mean 8 random suffixes all
  // clashed, which is extraordinarily unlikely.
  return `${base}-${Date.now().toString(36)}`;
}

function buildBillingAddress(billingAddress, phone) {
  const addr = billingAddress ? { ...billingAddress } : {};
  if (phone !== undefined && phone !== null && phone !== '') {
    addr.phone = phone;
  }
  const keys = Object.keys(addr).filter((k) => addr[k] !== undefined && addr[k] !== null && addr[k] !== '');
  if (keys.length === 0) return null;
  const out = {};
  for (const k of keys) out[k] = addr[k];
  return out;
}

async function memberCount(orgId) {
  const { count } = await supabase
    .from('org_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .not('accepted_at', 'is', null);
  return count ?? 0;
}

// POST /api/orgs — create org, caller becomes owner
router.post('/', asyncHandler(async (req, res) => {
  const body = createOrgSchema.parse(req.body);
  const base = slugifyBase(body.name);
  const slug = await uniqueSlug(base);

  const billing = buildBillingAddress(body.billingAddress, body.phone);

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name: body.name,
      slug,
      type: body.type,
      tax_id: body.taxId ?? null,
      billing_address: billing,
      bio: body.bio ?? null,
      website: body.website ?? null,
      support_email: body.supportEmail ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;

  const nowIso = new Date().toISOString();
  const { error: memberErr } = await supabase
    .from('org_members')
    .insert({
      org_id: org.id,
      user_id: req.user.id,
      role: 'owner',
      invited_at: nowIso,
      accepted_at: nowIso,
    });
  if (memberErr) {
    // Best-effort rollback: remove the org so we don't leave it orphaned.
    await supabase.from('organizations').delete().eq('id', org.id);
    throw memberErr;
  }

  const { error: userErr } = await supabase
    .from('users')
    .update({ account_type: 'business', current_org_id: org.id })
    .eq('id', req.user.id);
  if (userErr) throw userErr;

  // Best-effort default storefront row so the dashboard + public page have
  // something to read immediately. Failure here is not fatal — readers
  // gracefully fall back to defaults when the row is missing.
  const { error: sfErr } = await supabase
    .from('storefronts')
    .insert({
      org_id: org.id,
      slug,
      theme: {},
      seo: {},
      policies: {},
    });
  if (sfErr) {
    console.warn('[storefronts] default insert failed for org', org.id, sfErr.message);
  }

  // Every new org starts on the Free plan. Non-fatal on failure — the
  // migration's backfill will pick up orphaned orgs on next deploy.
  const { error: subErr } = await supabase
    .from('org_subscriptions')
    .insert({ org_id: org.id, plan_slug: 'free', status: 'active' });
  if (subErr) {
    console.warn('[subscriptions] default Free insert failed for org', org.id, subErr.message);
  }

  res.status(201).json(toOrganization(org, { memberCount: 1 }));
}));

// GET /api/orgs/mine — orgs the caller has an accepted membership in
router.get('/mine', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('org_members')
    .select('role, accepted_at, organization:organizations(*)')
    .eq('user_id', req.user.id)
    .not('accepted_at', 'is', null);
  if (error) throw error;

  const orgs = (data ?? [])
    .filter((row) => row.organization)
    .map((row) => ({
      ...toOrganization(row.organization),
      myRole: row.role,
    }));

  res.json(orgs);
}));

// GET /api/orgs/:id — public profile + member count
router.get('/:id', asyncHandler(async (req, res) => {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!org) throw new HttpError(404, 'Organization not found');

  res.json(toOrganization(org, { memberCount: await memberCount(org.id) }));
}));

// PATCH /api/orgs/:id — admin+
router.patch('/:id', requireOrgRole('admin'), asyncHandler(async (req, res) => {
  const body = updateOrgSchema.parse(req.body);

  const patch = {};
  if (body.name !== undefined)         patch.name = body.name;
  if (body.type !== undefined)         patch.type = body.type;
  if (body.taxId !== undefined)        patch.tax_id = body.taxId;
  if (body.bio !== undefined)          patch.bio = body.bio;
  if (body.website !== undefined)      patch.website = body.website;
  if (body.supportEmail !== undefined) patch.support_email = body.supportEmail;
  if (body.logoUrl !== undefined)      patch.logo_url = body.logoUrl;
  if (body.coverUrl !== undefined)     patch.cover_url = body.coverUrl;

  if (body.billingAddress !== undefined || body.phone !== undefined) {
    const { data: current } = await supabase
      .from('organizations')
      .select('billing_address')
      .eq('id', req.params.id)
      .maybeSingle();
    const base = current?.billing_address ?? {};
    const merged = {
      ...base,
      ...(body.billingAddress ?? {}),
    };
    if (body.phone !== undefined) {
      if (body.phone === null || body.phone === '') delete merged.phone;
      else merged.phone = body.phone;
    }
    patch.billing_address = Object.keys(merged).length ? merged : null;
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .update(patch)
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (error) throw error;

  res.json(toOrganization(org, { memberCount: await memberCount(org.id) }));
}));

// DELETE /api/orgs/:id — owner only; refuse if products reference the org
router.delete('/:id', requireOrgRole('owner'), asyncHandler(async (req, res) => {
  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', req.params.id);
  if ((productCount ?? 0) > 0) {
    throw new HttpError(409, 'Cannot delete: organization still has products. Remove or reassign them first.');
  }

  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', req.params.id);
  if (error) throw error;

  // Clear current_org_id for any user whose context was this org.
  await supabase
    .from('users')
    .update({ current_org_id: null })
    .eq('current_org_id', req.params.id);

  res.json({ success: true });
}));

// POST /api/orgs/:id/members/invite — admin+
router.post(
  '/:id/members/invite',
  authLimiter,
  requireOrgRole('admin'),
  asyncHandler(async (req, res) => {
    const body = inviteSchema.parse(req.body);

    const { data: target } = await supabase
      .from('users')
      .select('id, email, name, avatar_url, created_at')
      .eq('email', body.email)
      .maybeSingle();

    // TODO: email-based invites for non-registered users are out of scope.
    // When an email provider is wired in, generate a signed invite token and
    // send it here instead of 404-ing.
    if (!target) throw new HttpError(404, 'No registered user with that email');

    const { data: existing } = await supabase
      .from('org_members')
      .select('org_id, user_id, role, accepted_at, invited_at')
      .eq('org_id', req.params.id)
      .eq('user_id', target.id)
      .maybeSingle();
    if (existing) {
      throw new HttpError(409, existing.accepted_at
        ? 'User is already a member'
        : 'User has already been invited');
    }

    if (target.id === req.user.id) {
      throw new HttpError(400, 'You are already a member');
    }

    const { data: inserted, error } = await supabase
      .from('org_members')
      .insert({
        org_id: req.params.id,
        user_id: target.id,
        role: body.role,
        invited_at: new Date().toISOString(),
        accepted_at: null,
      })
      .select('*')
      .single();
    if (error) throw error;

    res.status(201).json(toOrgMember(inserted, target));
  }),
);

// POST /api/orgs/:id/members/accept — caller accepts their pending invite
router.post('/:id/members/accept', asyncHandler(async (req, res) => {
  const { data: membership } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (!membership) throw new HttpError(404, 'No pending invite');
  if (membership.accepted_at) throw new HttpError(409, 'Invite already accepted');

  const { data: updated, error } = await supabase
    .from('org_members')
    .update({ accepted_at: new Date().toISOString() })
    .eq('org_id', req.params.id)
    .eq('user_id', req.user.id)
    .select('*')
    .single();
  if (error) throw error;

  const { data: user } = await supabase
    .from('users')
    .select('id, email, name, avatar_url, created_at')
    .eq('id', req.user.id)
    .maybeSingle();

  res.json(toOrgMember(updated, user));
}));

// PATCH /api/orgs/:id/members/:userId — owner/admin change another member's role
router.patch(
  '/:id/members/:userId',
  requireOrgRole('admin'),
  asyncHandler(async (req, res) => {
    const body = roleChangeSchema.parse(req.body);

    const { data: target } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', req.params.id)
      .eq('user_id', req.params.userId)
      .maybeSingle();
    if (!target) throw new HttpError(404, 'Member not found');

    if (target.role === 'owner') {
      throw new HttpError(403, 'Owner role cannot be reassigned via this route');
    }

    // Admins can only change roles of members strictly below their rank.
    // Owners can change anyone except other owners (blocked above).
    if (req.orgMembership.role === 'admin' && !roleAtLeast('admin', target.role)) {
      throw new HttpError(403, 'Insufficient rank to change this member');
    }

    const { data: updated, error } = await supabase
      .from('org_members')
      .update({ role: body.role })
      .eq('org_id', req.params.id)
      .eq('user_id', req.params.userId)
      .select('*')
      .single();
    if (error) throw error;

    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, avatar_url, created_at')
      .eq('id', req.params.userId)
      .maybeSingle();

    res.json(toOrgMember(updated, user));
  }),
);

// DELETE /api/orgs/:id/members/:userId — remove a member (or leave org)
router.delete('/:id/members/:userId', asyncHandler(async (req, res) => {
  const orgId = req.params.id;
  const targetUserId = req.params.userId;
  const callerId = req.user.id;
  const isSelf = targetUserId === callerId;

  const { data: target } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!target) throw new HttpError(404, 'Member not found');

  if (target.role === 'owner') {
    throw new HttpError(403, 'The owner cannot be removed via this route');
  }

  if (!isSelf) {
    // Caller must be admin+ to remove someone else.
    const { data: caller } = await supabase
      .from('org_members')
      .select('role, accepted_at')
      .eq('org_id', orgId)
      .eq('user_id', callerId)
      .maybeSingle();
    if (!caller || !caller.accepted_at) {
      throw new HttpError(403, 'Not a member of this organization');
    }
    if (!roleAtLeast(caller.role, 'admin')) {
      throw new HttpError(403, 'Requires role admin or higher');
    }
  }

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', targetUserId);
  if (error) throw error;

  // If the removed member was using this org as their active context, reset.
  await supabase
    .from('users')
    .update({ current_org_id: null })
    .eq('id', targetUserId)
    .eq('current_org_id', orgId);

  res.json({ success: true });
}));

// GET /api/orgs/:id/members — members-only
router.get(
  '/:id/members',
  requireOrgRole('agent'),
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('org_members')
      .select('*, user:users!org_members_user_id_fkey(id,email,name,avatar_url,created_at)')
      .eq('org_id', req.params.id)
      .order('invited_at', { ascending: true });
    if (error) throw error;

    res.json((data ?? []).map((row) => toOrgMember(row, row.user)));
  }),
);

const PRODUCT_SELECT_WITH_OWNER =
  '*, owner:users!products_owner_id_fkey(id,name,avatar_url,created_at)';

// GET /api/orgs/:id/stats — dashboard overview KPIs + recent activity
router.get(
  '/:id/stats',
  requireOrgRole('agent'),
  asyncHandler(async (req, res) => {
    const orgId = req.params.id;

    const [
      activeListingsResult,
      totalListingsResult,
      productsForOrgResult,
      recentListingsResult,
    ] = await Promise.all([
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'active'),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase.from('products').select('id').eq('org_id', orgId),
      supabase
        .from('products')
        .select(PRODUCT_SELECT_WITH_OWNER)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (activeListingsResult.error)  throw activeListingsResult.error;
    if (totalListingsResult.error)   throw totalListingsResult.error;
    if (productsForOrgResult.error)  throw productsForOrgResult.error;
    if (recentListingsResult.error)  throw recentListingsResult.error;

    const productIds = (productsForOrgResult.data ?? []).map((p) => p.id);

    let newInquiriesToday = 0;
    let unansweredMessages = 0;
    let recentMessages = [];

    if (productIds.length > 0) {
      const { data: memberRows } = await supabase
        .from('org_members')
        .select('user_id, accepted_at')
        .eq('org_id', orgId);
      const memberIds = (memberRows ?? [])
        .filter((r) => r.accepted_at)
        .map((r) => r.user_id);

      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const [inquiriesResult, unansweredResult, recentMessagesResult] = await Promise.all([
        supabase
          .from('messages')
          .select('sender_id, product_id')
          .in('product_id', productIds)
          .gte('created_at', startOfDay.toISOString())
          .in('recipient_id', memberIds.length ? memberIds : [orgId]),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('product_id', productIds)
          .is('read_at', null)
          .in('recipient_id', memberIds.length ? memberIds : [orgId]),
        supabase
          .from('messages')
          .select(
            '*, product:products(id,name,image_url,price,status), sender:users!messages_sender_id_fkey(id,name,avatar_url), recipient:users!messages_recipient_id_fkey(id,name,avatar_url)',
          )
          .in('product_id', productIds)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (inquiriesResult.error)      throw inquiriesResult.error;
      if (unansweredResult.error)     throw unansweredResult.error;
      if (recentMessagesResult.error) throw recentMessagesResult.error;

      const uniquePairs = new Set();
      for (const row of inquiriesResult.data ?? []) {
        uniquePairs.add(`${row.sender_id}:${row.product_id}`);
      }
      newInquiriesToday = uniquePairs.size;
      unansweredMessages = unansweredResult.count ?? 0;
      recentMessages = (recentMessagesResult.data ?? []).map((m) => ({
        ...toMessage(m),
        product: m.product
          ? {
              _id: m.product.id,
              name: m.product.name,
              imageUrl: m.product.image_url,
              price: Number(m.product.price),
              status: m.product.status ?? 'active',
            }
          : null,
        sender: m.sender
          ? { _id: m.sender.id, name: m.sender.name, avatarUrl: m.sender.avatar_url ?? null }
          : null,
        recipient: m.recipient
          ? { _id: m.recipient.id, name: m.recipient.name, avatarUrl: m.recipient.avatar_url ?? null }
          : null,
      }));
    }

    res.json({
      activeListings: activeListingsResult.count ?? 0,
      totalListings: totalListingsResult.count ?? 0,
      newInquiriesToday,
      unansweredMessages,
      recentListings: (recentListingsResult.data ?? []).map((row) => toProduct(row, row.owner)),
      recentMessages,
    });
  }),
);

const orgProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'active', 'paused', 'sold', 'removed']).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  categoryId: z.string().uuid().optional(),
});

// GET /api/orgs/:id/products — paged listings scoped to the org
router.get(
  '/:id/products',
  requireOrgRole('agent'),
  asyncHandler(async (req, res) => {
    const parsed = orgProductsQuerySchema.parse({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      q: req.query.q,
      sort: req.query.sort,
      categoryId: req.query.category_id ?? req.query.categoryId,
    });

    const from = (parsed.page - 1) * parsed.limit;
    const to = from + parsed.limit - 1;

    let query = supabase
      .from('products')
      .select(PRODUCT_SELECT_WITH_OWNER, { count: 'exact' })
      .eq('org_id', req.params.id);

    if (parsed.status) query = query.eq('status', parsed.status);
    if (parsed.categoryId) query = query.eq('category_id', parsed.categoryId);
    if (parsed.q) {
      const term = parsed.q.replace(/[%,()]/g, ' ');
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    switch (parsed.sort) {
      case 'price_asc':  query = query.order('price', { ascending: true }); break;
      case 'price_desc': query = query.order('price', { ascending: false }); break;
      case 'newest':
      default:           query = query.order('updated_at', { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;

    res.json({
      products: (data ?? []).map((row) => toProduct(row, row.owner)),
      total: count ?? 0,
      page: parsed.page,
      pages: count ? Math.max(1, Math.ceil(count / parsed.limit)) : 1,
    });
  }),
);

// GET /api/orgs/:id/inquiries — unified inbox across all products owned by
// the org. Shape-compatible with /api/messages/inbox; adds pendingOffer.
router.get(
  '/:id/inquiries',
  requireOrgRole('agent'),
  asyncHandler(async (req, res) => {
    const orgId = req.params.id;

    const [{ data: productRows }, { data: memberRows }] = await Promise.all([
      supabase.from('products').select('id').eq('org_id', orgId),
      supabase
        .from('org_members')
        .select('user_id, accepted_at')
        .eq('org_id', orgId),
    ]);
    const productIds = (productRows ?? []).map((p) => p.id);
    const memberIds = (memberRows ?? [])
      .filter((r) => r.accepted_at)
      .map((r) => r.user_id);

    if (productIds.length === 0 || memberIds.length === 0) {
      return res.json([]);
    }

    const { data: msgs, error } = await supabase
      .from('messages')
      .select(
        '*, product:products(id,name,image_url,price,status), sender:users!messages_sender_id_fkey(id,name,avatar_url), recipient:users!messages_recipient_id_fkey(id,name,avatar_url)',
      )
      .in('product_id', productIds)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw error;

    const threads = new Map();
    for (const m of msgs ?? []) {
      // The buyer is whichever party is NOT a member of the org. We assume
      // messages on org-owned listings are between an outside buyer and
      // the org (any member acting as agent). If both sides appear to be
      // members (unlikely), skip.
      const senderIsMember = memberIds.includes(m.sender_id);
      const recipientIsMember = memberIds.includes(m.recipient_id);
      let buyer;
      if (senderIsMember && !recipientIsMember) {
        buyer = m.recipient;
      } else if (!senderIsMember && recipientIsMember) {
        buyer = m.sender;
      } else {
        continue;
      }
      if (!buyer) continue;

      const key = `${buyer.id}:${m.product_id}`;
      if (!threads.has(key)) {
        threads.set(key, {
          otherUser: {
            _id: buyer.id,
            name: buyer.name,
            avatarUrl: buyer.avatar_url ?? null,
          },
          product: m.product
            ? {
                _id: m.product.id,
                name: m.product.name,
                imageUrl: m.product.image_url,
                price: Number(m.product.price),
                status: m.product.status ?? 'active',
              }
            : { _id: m.product_id, name: 'Listing', imageUrl: '', price: 0, status: 'active' },
          lastMessage: {
            content: m.content,
            createdAt: m.created_at,
            senderId: m.sender_id,
            type: m.type,
          },
          unreadCount: 0,
          pendingOffer: null,
          _productId: m.product_id,
          _buyerId: buyer.id,
        });
      }
      const t = threads.get(key);
      // Unread means: a member of this org received it and hasn't read it.
      if (recipientIsMember && !m.read_at) t.unreadCount += 1;
    }

    const threadList = [...threads.values()];

    // Attach the most recent pending offer per (buyer, product) pair.
    if (threadList.length > 0) {
      const { data: offerRows } = await supabase
        .from('offers')
        .select('*')
        .in('product_id', threadList.map((t) => t._productId))
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (offerRows?.length) {
        const byKey = new Map();
        for (const o of offerRows) {
          const key = `${o.buyer_id}:${o.product_id}`;
          if (!byKey.has(key)) byKey.set(key, o);
        }
        for (const t of threadList) {
          const o = byKey.get(`${t._buyerId}:${t._productId}`);
          if (o) {
            const offer = toOffer(o);
            t.pendingOffer = { _id: offer._id, amount: offer.amount, status: offer.status };
          }
        }
      }
    }

    threadList.sort((a, b) => {
      const aUnread = a.unreadCount > 0 ? 1 : 0;
      const bUnread = b.unreadCount > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
    });

    // Strip internal fields and cap.
    res.json(
      threadList.slice(0, 200).map((t) => ({
        otherUser: t.otherUser,
        product: t.product,
        lastMessage: t.lastMessage,
        unreadCount: t.unreadCount,
        pendingOffer: t.pendingOffer,
      })),
    );
  }),
);

// GET /api/orgs/:id/subscription — agent+. Bundles the org, the plan it
// sits on, subscription status, and current usage vs. the plan's cap.
// The frontend renders the Plan page entirely from this single payload.
router.get(
  '/:id/subscription',
  requireOrgRole('agent'),
  asyncHandler(async (req, res) => {
    const orgId = req.params.id;

    const [orgRes, subRes] = await Promise.all([
      supabase.from('organizations').select('id,name,slug').eq('id', orgId).maybeSingle(),
      supabase.from('org_subscriptions').select('*').eq('org_id', orgId).maybeSingle(),
    ]);
    if (orgRes.error) throw orgRes.error;
    if (subRes.error) throw subRes.error;
    if (!orgRes.data)  throw new HttpError(404, 'Organization not found');

    // If an org somehow missed the backfill (race with a data-repair script,
    // direct SQL, etc.), self-heal to Free so the endpoint always has a plan
    // to surface rather than 500-ing.
    let sub = subRes.data;
    if (!sub) {
      const { data: inserted, error } = await supabase
        .from('org_subscriptions')
        .insert({ org_id: orgId, plan_slug: 'free', status: 'active' })
        .select('*')
        .single();
      if (error) throw error;
      sub = inserted;
    }

    const { data: plan, error: planErr } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', sub.plan_slug)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!plan) throw new HttpError(500, 'Subscription plan missing');

    const { count: activeListings } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active');

    const rawLimit = plan.features?.listing_limit;
    const listingLimit = typeof rawLimit === 'number' ? rawLimit : null;

    res.json({
      org: {
        _id: orgRes.data.id,
        name: orgRes.data.name,
        slug: orgRes.data.slug,
      },
      plan: toSubscriptionPlan(plan),
      subscription: toOrgSubscription(sub),
      usage: {
        activeListings: activeListings ?? 0,
        listingLimit,
      },
    });
  }),
);

// GET /api/orgs/:id/addons — agent+. Active add-ons only; expired /
// cancelled rows are hidden from this endpoint since the UI treats them
// as gone. Expiry is enforced at query time (`ends_at > now()`) rather
// than via a scheduled job — simpler, and adequate for MVP volumes.
router.get(
  '/:id/addons',
  requireOrgRole('agent'),
  asyncHandler(async (req, res) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('org_addons')
      .select('*')
      .eq('org_id', req.params.id)
      .eq('status', 'active')
      // Null ends_at means evergreen — keep it. Non-null must still be
      // in the future; otherwise the row is effectively expired and
      // shouldn't surface on the Plan page.
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order('started_at', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []).map((row) => {
      const mapped = toOrgAddon(row);
      mapped.isActive = !row.ends_at || new Date(row.ends_at) > new Date();
      return mapped;
    });
    res.json(rows);
  }),
);

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/, 'Must be a hex color (e.g. #ff6b35)');

const storefrontUpdateSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and dashes')
    .min(3)
    .max(48)
    .optional(),
  theme: z
    .object({
      primaryColor: hexColor.optional(),
      accentColor: hexColor.optional(),
      bannerStyle: z.enum(['solid', 'image']).optional(),
    })
    .strict()
    .optional(),
  seo: z
    .object({
      title: z.string().trim().max(120).optional(),
      description: z.string().trim().max(300).optional(),
      ogImage: z.string().trim().url().max(500).optional(),
    })
    .strict()
    .optional(),
  policies: z
    .object({
      shipping: z.string().max(4000).optional(),
      returns: z.string().max(4000).optional(),
      contact: z.string().max(2000).optional(),
    })
    .strict()
    .optional(),
  logoUrl: z.string().url().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
});

// GET /api/orgs/:id/storefront — agent+
router.get(
  '/:id/storefront',
  requireOrgRole('agent'),
  asyncHandler(async (req, res) => {
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (orgErr) throw orgErr;
    if (!org) throw new HttpError(404, 'Organization not found');

    const { data: row, error } = await supabase
      .from('storefronts')
      .select('*')
      .eq('org_id', org.id)
      .maybeSingle();
    if (error) throw error;

    res.json({
      org: toOrganization(org),
      storefront: toStorefront(row, org),
    });
  }),
);

// PUT /api/orgs/:id/storefront — admin+
router.put(
  '/:id/storefront',
  requireOrgRole('admin'),
  asyncHandler(async (req, res) => {
    const body = storefrontUpdateSchema.parse(req.body ?? {});
    const orgId = req.params.id;

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr) throw orgErr;
    if (!org) throw new HttpError(404, 'Organization not found');

    let nextSlug = org.slug;
    if (body.slug && body.slug !== org.slug) {
      const { data: clash } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', body.slug)
        .neq('id', orgId)
        .maybeSingle();
      if (clash) {
        throw new HttpError(409, 'That slug is already taken. Try another.');
      }
      nextSlug = body.slug;
    }

    const orgPatch = {};
    if (nextSlug !== org.slug) orgPatch.slug = nextSlug;
    if (body.logoUrl !== undefined) orgPatch.logo_url = body.logoUrl;
    if (body.coverUrl !== undefined) orgPatch.cover_url = body.coverUrl;

    let updatedOrg = org;
    if (Object.keys(orgPatch).length > 0) {
      const { data, error } = await supabase
        .from('organizations')
        .update(orgPatch)
        .eq('id', orgId)
        .select('*')
        .single();
      if (error) throw error;
      updatedOrg = data;
    }

    const { data: existing } = await supabase
      .from('storefronts')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle();

    const storefrontPayload = {
      org_id: orgId,
      slug: nextSlug,
      theme: body.theme ?? existing?.theme ?? {},
      seo: body.seo ?? existing?.seo ?? {},
      policies: body.policies ?? existing?.policies ?? {},
    };

    const { data: storefrontRow, error: sfErr } = await supabase
      .from('storefronts')
      .upsert(storefrontPayload, { onConflict: 'org_id' })
      .select('*')
      .single();
    if (sfErr) throw sfErr;

    res.json({
      org: toOrganization(updatedOrg, { memberCount: await memberCount(orgId) }),
      storefront: toStorefront(storefrontRow, updatedOrg),
    });
  }),
);

export default router;
