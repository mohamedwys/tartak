import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { toOrder } from '../utils/mapping.js';

const router = Router();
router.use(requireAuth);

const itemSchema = z.object({
  productId: z.string(),
  name:      z.string(),
  price:     z.coerce.number().nonnegative(),
  quantity:  z.coerce.number().int().positive(),
  imageUrl:  z.string().optional().nullable(),
});
const addressSchema = z.object({
  fullName:   z.string().trim().min(1).max(120),
  street:     z.string().trim().min(1).max(200),
  city:       z.string().trim().min(1).max(120),
  postalCode: z.string().trim().min(1).max(20),
});
const orderSchema = z.object({
  items:           z.array(itemSchema).min(1),
  total:           z.coerce.number().nonnegative(),
  shippingAddress: addressSchema,
});

const TOTAL_TOLERANCE = 0.01;

// POST /api/orders
router.post('/', asyncHandler(async (req, res) => {
  const body = orderSchema.parse(req.body);

  const productIds = [...new Set(body.items.map((i) => i.productId))];
  const { data: rows, error: lookupError } = await supabase
    .from('products')
    .select('id, price, sold')
    .in('id', productIds);
  if (lookupError) throw lookupError;

  const priceById = new Map((rows ?? []).map((r) => [r.id, Number(r.price)]));
  for (const item of body.items) {
    if (!priceById.has(item.productId)) {
      throw new HttpError(400, `Unknown product: ${item.productId}`);
    }
  }

  const subtotal = body.items.reduce(
    (sum, item) => sum + priceById.get(item.productId) * item.quantity,
    0,
  );
  // TODO: replace with real tax/shipping calculation once those rules land.
  const shipping = 0;
  const tax = 0;
  const computedTotal = subtotal + shipping + tax;

  if (Math.abs(computedTotal - body.total) > TOTAL_TOLERANCE) {
    throw new HttpError(400, 'Order total does not match server calculation', {
      expected: Number(computedTotal.toFixed(2)),
      received: body.total,
    });
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      buyer_id:          req.user.id,
      items:             body.items,
      total:             computedTotal,
      shipping_address:  body.shippingAddress,
    })
    .select('*').single();
  if (error) throw error;
  res.status(201).json(toOrder(data));
}));

// GET /api/orders
router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('orders').select('*').eq('buyer_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json((data ?? []).map(toOrder));
}));

export default router;
