import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { toRating } from '../utils/mapping.js';

const router = Router();

const submitSchema = z.object({
  sellerId: z.string().uuid(),
  stars:    z.coerce.number().int().min(1).max(5),
  comment:  z.string().trim().max(2000).optional(),
});

// POST /api/ratings
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const body = submitSchema.parse(req.body);
  if (body.sellerId === req.user.id) throw new HttpError(400, 'Cannot rate yourself');

  const { data: seller } = await supabase
    .from('users').select('id').eq('id', body.sellerId).maybeSingle();
  if (!seller) throw new HttpError(404, 'Seller not found');

  const { data, error } = await supabase
    .from('ratings')
    .upsert(
      {
        seller_id:   body.sellerId,
        reviewer_id: req.user.id,
        stars:       body.stars,
        comment:     body.comment ?? null,
      },
      { onConflict: 'seller_id,reviewer_id' },
    )
    .select('*, reviewer:users!ratings_reviewer_id_fkey(id,name,avatar_url,created_at)')
    .single();
  if (error) throw error;
  res.status(201).json(toRating(data, data.reviewer));
}));

// GET /api/ratings/seller/:sellerId
router.get('/seller/:sellerId', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('ratings')
    .select('*, reviewer:users!ratings_reviewer_id_fkey(id,name,avatar_url,created_at)')
    .eq('seller_id', req.params.sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json((data ?? []).map(r => toRating(r, r.reviewer)));
}));

export default router;
