import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { storefrontReadLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { toOrganization, toProduct, toStorefront } from '../utils/mapping.js';

const router = Router();

// GET /api/storefronts/:slug — public; no auth.
router.get('/:slug', storefrontReadLimiter, asyncHandler(async (req, res) => {
  const slug = String(req.params.slug ?? '').toLowerCase();
  if (!slug) throw new HttpError(400, 'Missing slug');

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (orgErr) throw orgErr;
  if (!org) throw new HttpError(404, 'Storefront not found');
  if (org.kyb_status === 'rejected') throw new HttpError(404, 'Storefront not found');

  const [storefrontRes, productsRes, memberRes] = await Promise.all([
    supabase.from('storefronts').select('*').eq('org_id', org.id).maybeSingle(),
    supabase
      .from('products')
      .select('*, owner:users!products_owner_id_fkey(id,name,avatar_url,created_at)')
      .eq('org_id', org.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(24),
    supabase
      .from('org_members')
      .select('user_id, accepted_at')
      .eq('org_id', org.id),
  ]);

  if (storefrontRes.error) throw storefrontRes.error;
  if (productsRes.error) throw productsRes.error;
  if (memberRes.error) throw memberRes.error;

  const memberIds = (memberRes.data ?? [])
    .filter((m) => m.accepted_at)
    .map((m) => m.user_id);

  let average = null;
  let count = 0;
  if (memberIds.length > 0) {
    const { data: ratingRows } = await supabase
      .from('ratings')
      .select('stars')
      .in('seller_id', memberIds);
    if (ratingRows?.length) {
      count = ratingRows.length;
      const sum = ratingRows.reduce((acc, r) => acc + Number(r.stars ?? 0), 0);
      average = Math.round((sum / count) * 10) / 10;
    }
  }

  res.json({
    org: toOrganization(org),
    storefront: toStorefront(storefrontRes.data, org),
    products: (productsRes.data ?? []).map((row) => toProduct(row, row.owner)),
    ratings: { average, count },
  });
}));

export default router;
