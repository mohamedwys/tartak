import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { toUserProfile } from '../utils/mapping.js';

const router = Router();

// GET /api/user/:id/profile
// Public seller profile including aggregate rating stats.
router.get('/:id/profile', asyncHandler(async (req, res) => {
  const { data: user } = await supabase
    .from('users').select('*').eq('id', req.params.id).maybeSingle();
  if (!user) throw new HttpError(404, 'User not found');

  const { data: stats } = await supabase
    .from('ratings').select('stars').eq('seller_id', user.id);

  const ratingCount = stats?.length ?? 0;
  const avgRating = ratingCount
    ? Number((stats.reduce((s, r) => s + r.stars, 0) / ratingCount).toFixed(2))
    : null;

  res.json(toUserProfile(user, { avgRating, ratingCount }));
}));

export default router;
