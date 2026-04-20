import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { roleAtLeast } from '../middleware/org.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { toProduct } from '../utils/mapping.js';
import { resolveCategoryDescendantIds } from './categories.routes.js';

const router = Router();

const productWriteSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  price: z.coerce.number().nonnegative(),
  category: z.string().trim().min(1).max(80),
  // New: optional FK into the categories table. Kept alongside the
  // legacy `category` text for back-compat.
  categoryId: z.string().uuid().optional().nullable(),
  condition: z.string().trim().max(40).optional().nullable(),
  imageUrl: z.string().url(),
  imageUrls: z.array(z.string().url()).optional().default([]),
});

const SELECT_WITH_OWNER =
  '*, owner:users!products_owner_id_fkey(id,name,avatar_url,created_at), org:organizations!products_org_id_fkey(id,name,slug)';

// GET /api/products — list with filters + pagination
router.get('/', asyncHandler(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const from  = (page - 1) * limit;
  const to    = from + limit - 1;

  let q = supabase.from('products').select(SELECT_WITH_OWNER, { count: 'exact' });

  if (req.query.ownerId)   q = q.eq('owner_id', String(req.query.ownerId));
  if (req.query.category)  q = q.eq('category', String(req.query.category));
  if (req.query.condition) q = q.eq('condition', String(req.query.condition));
  if (req.query.minPrice)  q = q.gte('price', Number(req.query.minPrice));
  if (req.query.maxPrice)  q = q.lte('price', Number(req.query.maxPrice));

  // Category tree filter. If includeDescendants is true, resolve the
  // full descendant id set server-side and filter with `.in()`. Without
  // includeDescendants, we just match the exact category_id.
  if (req.query.categoryId) {
    const catId = String(req.query.categoryId);
    const includeDesc = String(req.query.includeDescendants ?? 'false') === 'true';
    if (includeDesc) {
      const ids = await resolveCategoryDescendantIds(catId);
      q = q.in('category_id', ids);
    } else {
      q = q.eq('category_id', catId);
    }
  }

  // mode: 'pro' → business listings (org-scoped)
  //       'marketplace' → C2C listings (no org)
  //       'all' (default) → no filter, preserves legacy behavior
  const mode = String(req.query.mode ?? 'all');
  if (mode === 'pro')         q = q.not('org_id', 'is', null);
  else if (mode === 'marketplace') q = q.is('org_id', null);
  if (req.query.q) {
    const term = String(req.query.q).replace(/[%,()]/g, ' ');
    q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  switch (String(req.query.sort ?? 'newest')) {
    case 'price_asc':  q = q.order('price', { ascending: true }); break;
    case 'price_desc': q = q.order('price', { ascending: false }); break;
    case 'newest':
    default:           q = q.order('created_at', { ascending: false });
  }

  const { data, count, error } = await q.range(from, to);
  if (error) throw error;

  res.json({
    products: (data ?? []).map(row => toProduct(row, row.owner)),
    total: count ?? 0,
    page,
    pages: count ? Math.max(1, Math.ceil(count / limit)) : 1,
  });
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('products').select(SELECT_WITH_OWNER).eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Product not found');
  res.json(toProduct(data, data.owner));
}));

// GET /api/products/:id/similar — same category, exclude the product itself.
// Prefer category_id matching when available; fall back to the legacy
// text category only when the source has no category_id set.
router.get('/:id/similar', asyncHandler(async (req, res) => {
  const { data: source } = await supabase
    .from('products').select('id,category,category_id').eq('id', req.params.id).maybeSingle();
  if (!source) return res.json([]);

  let q = supabase
    .from('products').select(SELECT_WITH_OWNER)
    .neq('id', source.id).eq('sold', false);

  if (source.category_id) q = q.eq('category_id', source.category_id);
  else                    q = q.eq('category', source.category);

  const { data } = await q.order('created_at', { ascending: false }).limit(6);
  res.json((data ?? []).map(row => toProduct(row, row.owner)));
}));

// POST /api/products
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const body = productWriteSchema.parse(req.body);
  const { data, error } = await supabase
    .from('products')
    .insert({
      owner_id: req.user.id,
      org_id: req.user.currentOrgId ?? null,
      name: body.name,
      description: body.description,
      price: body.price,
      category: body.category,
      category_id: body.categoryId ?? null,
      condition: body.condition ?? null,
      image_url: body.imageUrl,
      image_urls: body.imageUrls ?? [],
    })
    .select(SELECT_WITH_OWNER).single();
  if (error) throw error;
  res.status(201).json(toProduct(data, data.owner));
}));

async function assertOwnership(productId, userId) {
  const { data: row } = await supabase
    .from('products').select('owner_id').eq('id', productId).maybeSingle();
  if (!row) throw new HttpError(404, 'Product not found');
  if (row.owner_id !== userId) throw new HttpError(403, 'Not your listing');
}

// PUT /api/products/:id
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  await assertOwnership(req.params.id, req.user.id);
  const body = productWriteSchema.parse(req.body);
  const { data, error } = await supabase
    .from('products')
    .update({
      name: body.name,
      description: body.description,
      price: body.price,
      category: body.category,
      category_id: body.categoryId ?? null,
      condition: body.condition ?? null,
      image_url: body.imageUrl,
      image_urls: body.imageUrls ?? [],
    })
    .eq('id', req.params.id)
    .select(SELECT_WITH_OWNER).single();
  if (error) throw error;
  res.json(toProduct(data, data.owner));
}));

// DELETE /api/products/:id
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  await assertOwnership(req.params.id, req.user.id);
  const { error } = await supabase.from('products').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ success: true });
}));

const statusSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'sold', 'removed']),
});

// Helper: caller must be the product owner OR an agent+ member of the
// product's org. Returns the product row on success.
async function assertStatusPermission(productId, user) {
  const { data: row, error } = await supabase
    .from('products')
    .select('id, owner_id, org_id')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new HttpError(404, 'Product not found');

  if (row.owner_id === user.id) return row;

  if (row.org_id) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('role, accepted_at')
      .eq('org_id', row.org_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membership?.accepted_at && roleAtLeast(membership.role, 'agent')) {
      return row;
    }
  }
  throw new HttpError(403, 'Not permitted to change this listing');
}

async function updateProductStatus(productId, status) {
  const patch = { status };
  // Keep the legacy boolean in sync so existing list filters that still
  // consult `sold` behave correctly.
  if (status === 'sold') patch.sold = true;
  else patch.sold = false;

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', productId)
    .select(SELECT_WITH_OWNER)
    .single();
  if (error) throw error;
  return data;
}

// PATCH /api/products/:id/status — owner of product OR agent+ of org
router.patch('/:id/status', requireAuth, asyncHandler(async (req, res) => {
  const body = statusSchema.parse(req.body);
  await assertStatusPermission(req.params.id, req.user);
  const data = await updateProductStatus(req.params.id, body.status);
  res.json(toProduct(data, data.owner));
}));

// PATCH /api/products/:id/sold — kept for back-compat; delegates to the
// new status logic with status='sold' (and sold=true).
router.patch('/:id/sold', requireAuth, asyncHandler(async (req, res) => {
  await assertStatusPermission(req.params.id, req.user);
  const data = await updateProductStatus(req.params.id, 'sold');
  res.json(toProduct(data, data.owner));
}));

export default router;
