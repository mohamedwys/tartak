import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/async.js';

const router = Router();

const reportSchema = z.object({
  productId: z.string().uuid(),
  reason:    z.string().trim().min(1).max(200),
});

// POST /api/reports
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const body = reportSchema.parse(req.body);

  const { data: product } = await supabase
    .from('products').select('id').eq('id', body.productId).maybeSingle();
  if (!product) throw new HttpError(404, 'Product not found');

  const { error } = await supabase.from('reports').insert({
    product_id:  body.productId,
    reporter_id: req.user.id,
    reason:      body.reason,
  });
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'You already reported this listing');
    throw error;
  }
  res.status(201).json({ success: true });
}));

export default router;
