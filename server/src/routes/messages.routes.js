import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { toMessage } from '../utils/mapping.js';

const router = Router();
router.use(requireAuth);

const sendSchema = z.object({
  recipientId: z.string().uuid(),
  productId:   z.string().uuid(),
  content:     z.string().trim().min(1).max(4000),
});

// POST /api/messages
router.post('/', asyncHandler(async (req, res) => {
  const body = sendSchema.parse(req.body);
  if (body.recipientId === req.user.id) {
    throw new HttpError(400, 'Cannot message yourself');
  }
  // Validate recipient + product
  const [{ data: recipient }, { data: product }] = await Promise.all([
    supabase.from('users').select('id').eq('id', body.recipientId).maybeSingle(),
    supabase.from('products').select('id').eq('id', body.productId).maybeSingle(),
  ]);
  if (!recipient) throw new HttpError(404, 'Recipient not found');
  if (!product)   throw new HttpError(404, 'Product not found');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id:    req.user.id,
      recipient_id: body.recipientId,
      product_id:   body.productId,
      content:      body.content,
      type:         'text',
    })
    .select('*').single();
  if (error) throw error;
  res.status(201).json(toMessage(data));
}));

// GET /api/messages/inbox
// Returns one row per (otherUser, product) thread with last message + unread count.
router.get('/inbox', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const { data: msgs, error } = await supabase
    .from('messages')
    .select('*, product:products(id,name,image_url,price), sender:users!messages_sender_id_fkey(id,name,avatar_url), recipient:users!messages_recipient_id_fkey(id,name,avatar_url)')
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const threads = new Map();
  for (const m of msgs ?? []) {
    const other = m.sender_id === me ? m.recipient : m.sender;
    if (!other) continue;
    const key = `${other.id}:${m.product_id}`;
    if (!threads.has(key)) {
      threads.set(key, {
        otherUser: { _id: other.id, name: other.name, avatarUrl: other.avatar_url ?? null },
        product: m.product
          ? { _id: m.product.id, name: m.product.name, imageUrl: m.product.image_url, price: Number(m.product.price) }
          : { _id: m.product_id, name: 'Listing', imageUrl: '' },
        lastMessage: { content: m.content, createdAt: m.created_at, senderId: m.sender_id, type: m.type },
        unreadCount: 0,
      });
    }
    const t = threads.get(key);
    if (m.recipient_id === me && !m.read_at) t.unreadCount += 1;
  }

  res.json([...threads.values()]);
}));

// GET /api/messages/conversation/:userId/:productId
router.get('/conversation/:userId/:productId', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const { userId, productId } = req.params;

  const { data, error } = await supabase
    .from('messages')
    .select('*, offer:offers(*)')
    .eq('product_id', productId)
    .or(`and(sender_id.eq.${me},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${me})`)
    .order('created_at', { ascending: true });
  if (error) throw error;

  res.json((data ?? []).map(m => toMessage(m, m.offer)));
}));

// PATCH /api/messages/conversation/:userId/:productId/read
router.patch('/conversation/:userId/:productId/read', asyncHandler(async (req, res) => {
  const me = req.user.id;
  const { userId, productId } = req.params;
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('product_id', productId)
    .eq('sender_id', userId)
    .eq('recipient_id', me)
    .is('read_at', null);
  if (error) throw error;
  res.json({ success: true });
}));

export default router;
