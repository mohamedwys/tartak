import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/async.js';
import { toBanner, toTile, toProduct, toOrganization } from '../utils/mapping.js';

const router = Router();

const SELECT_PRODUCT_WITH_OWNER =
  '*, owner:users!products_owner_id_fkey(id,name,avatar_url,created_at), org:organizations!products_org_id_fkey(id,name,slug)';

// GET /api/home — composed surface for the Pro homepage.
// Public, unauthenticated. Returns banners + tiles + a featured block
// so a single round-trip is enough to paint the page above the grid.
router.get('/', asyncHandler(async (_req, res) => {
  const nowIso = new Date().toISOString();
  const started = Date.now();

  const [bannersRes, tilesRes, trendingRes, storefrontsRes] = await Promise.all([
    supabase
      .from('home_banners')
      .select('*')
      .eq('active', true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order('sort_order', { ascending: true })
      .limit(6),
    supabase
      .from('home_tiles')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(12),
    supabase
      .from('products')
      .select(SELECT_PRODUCT_WITH_OWNER)
      .eq('status', 'active')
      .not('org_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8),
    // Verified organisations with at least one active Pro listing.
    // We over-fetch then filter in memory so we don't need a SQL join —
    // existence check is implied by the products query above (most recent
    // 200 active listings will cover the typical 4 featured storefronts).
    supabase
      .from('organizations')
      .select('*')
      .eq('kyb_status', 'verified')
      .order('created_at', { ascending: false })
      .limit(24),
  ]);

  if (bannersRes.error) throw bannersRes.error;
  if (tilesRes.error) throw tilesRes.error;
  if (trendingRes.error) throw trendingRes.error;
  if (storefrontsRes.error) throw storefrontsRes.error;

  const verifiedOrgs = storefrontsRes.data ?? [];
  let featuredStorefronts = [];
  if (verifiedOrgs.length > 0) {
    const orgIds = verifiedOrgs.map((o) => o.id);
    const { data: activeRows, error: activeErr } = await supabase
      .from('products')
      .select('org_id')
      .in('org_id', orgIds)
      .eq('status', 'active')
      .limit(500);
    if (activeErr) throw activeErr;

    const orgsWithActive = new Set((activeRows ?? []).map((r) => r.org_id));
    featuredStorefronts = verifiedOrgs
      .filter((o) => orgsWithActive.has(o.id))
      .slice(0, 4)
      .map((o) => toOrganization(o));
  }

  const elapsed = Date.now() - started;
  if (elapsed > 300) {
    console.warn(`[home] /api/home took ${elapsed}ms`);
  }

  res.json({
    banners: (bannersRes.data ?? []).map(toBanner),
    tiles:   (tilesRes.data ?? []).map(toTile),
    featured: {
      trending: (trendingRes.data ?? []).map((row) => toProduct(row, row.owner)),
      featuredStorefronts,
    },
  });
}));

export default router;
