import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { toOffer } from '../utils/mapping.js';

const router = Router();
router.use(requireAuth);

const makeOfferSchema = z.object({
  productId: z.string().uuid(),
  amount:    z.coerce.number().positive(),
  message:   z.string().trim().max(2000).optional(),
});
const respondSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

// POST /api/offers
// Creates offer + a linked `type:offer` message so the seller sees it in chat.
router.post('/', asyncHandler(async (req, res) => {
  const body = makeOfferSchema.parse(req.body);
  const buyerId = req.user.id;

  const { data: product } = await supabase
    .from('products').select('id,owner_id,name,price').eq('id', body.productId).maybeSingle();
  if (!product) throw new HttpError(404, 'Product not found');
  if (product.owner_id === buyerId) throw new HttpError(400, 'Cannot offer on your own listing');

  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .insert({
      product_id: product.id,
      buyer_id:   buyerId,
      seller_id:  product.owner_id,
      amount:     body.amount,
      message:    body.message ?? null,
      status:     'pending',
    })
    .select('*').single();
  if (offerErr) throw offerErr;

  const contentSummary = body.message
    ? `Offer: $${body.amount} — "${body.message}"`
    : `Offer: $${body.amount}`;
  const { error: msgErr } = await supabase.from('messages').insert({
    sender_id:    buyerId,
    recipient_id: product.owner_id,
    product_id:   product.id,
    content:      contentSummary,
    type:         'offer',
    offer_id:     offer.id,
  });
  if (msgErr) throw msgErr;

  res.status(201).json(toOffer(offer));
}));

// GET /api/offers/mine — offers I made (as buyer)
router.get('/mine', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('offers').select('*').eq('buyer_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json((data ?? []).map(toOffer));
}));

// GET /api/offers/product/:productId — offers for my listing
router.get('/product/:productId', asyncHandler(async (req, res) => {
  const { data: product } = await supabase
    .from('products').select('owner_id').eq('id', req.params.productId).maybeSingle();
  if (!product) throw new HttpError(404, 'Product not found');
  if (product.owner_id !== req.user.id) throw new HttpError(403, 'Not your listing');

  const { data, error } = await supabase
    .from('offers').select('*').eq('product_id', req.params.productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json((data ?? []).map(toOffer));
}));

// PATCH /api/offers/:offerId
router.patch('/:offerId', asyncHandler(async (req, res) => {
  const { status } = respondSchema.parse(req.body);

  const { data: existing } = await supabase
    .from('offers').select('*').eq('id', req.params.offerId).maybeSingle();
  if (!existing) throw new HttpError(404, 'Offer not found');
  if (existing.seller_id !== req.user.id) throw new HttpError(403, 'Only the seller can respond');
  if (existing.status !== 'pending') throw new HttpError(409, 'Offer already responded to');

  const { data, error } = await supabase
    .from('offers').update({ status }).eq('id', existing.id)
    .select('*').single();
  if (error) throw error;
  res.json(toOffer(data));
}));

export default router;
