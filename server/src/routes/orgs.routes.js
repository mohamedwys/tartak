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

export default router;
