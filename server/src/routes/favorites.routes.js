import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { toProduct } from '../utils/mapping.js';

const router = Router();
router.use(requireAuth);

// POST /api/favorites/:productId — toggle favorite
router.post('/:productId', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;

  // Ensure product exists
  const { data: product } = await supabase
    .from('products').select('id').eq('id', productId).maybeSingle();
  if (!product) throw new HttpError(404, 'Product not found');

  const { data: existing } = await supabase
    .from('favorites').select('user_id').eq('user_id', userId).eq('product_id', productId).maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
    return res.json({ favorited: false });
  }
  const { error } = await supabase.from('favorites').insert({ user_id: userId, product_id: productId });
  if (error) throw error;
  res.json({ favorited: true });
}));

// GET /api/favorites/ids
router.get('/ids', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('favorites').select('product_id').eq('user_id', req.user.id);
  if (error) throw error;
  res.json((data ?? []).map(r => r.product_id));
}));

// GET /api/favorites — full product payloads
router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('favorites')
    .select('product:products(*, owner:users!products_owner_id_fkey(id,name,avatar_url,created_at))')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json((data ?? [])
    .map(row => row.product)
    .filter(Boolean)
    .map(p => toProduct(p, p.owner)));
}));

export default router;
