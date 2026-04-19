import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { signAuthToken, signScopedToken, verifyScopedToken } from '../utils/jwt.js';
import { asyncHandler, HttpError } from '../utils/async.js';
import { requireAuth } from '../middleware/auth.js';
import { toUserProfile } from '../utils/mapping.js';
import { env } from '../config/env.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(200),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  avatarUrl: z.string().url().optional(),
});
const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
const resetSchema  = z.object({ password: z.string().min(6).max(200) });

// POST /api/user/register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);

  const { data: existing } = await supabase
    .from('users').select('id').eq('email', email).maybeSingle();
  if (existing) throw new HttpError(409, 'Email already registered');

  const password_hash = await bcrypt.hash(password, 12);
  const verification_token = crypto.randomBytes(24).toString('hex');

  const { data: user, error } = await supabase
    .from('users')
    .insert({ name, email, password_hash, verification_token })
    .select('*').single();
  if (error) throw error;

  // TODO: wire real mail provider; for now the link is logged for dev.
  const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(verification_token)}`;
  if (env.nodeEnv !== 'production') console.log('[dev] verification link:', verifyUrl);

  const token = signAuthToken(user);
  res.status(201).json({ token, user: toUserProfile(user) });
}));

// POST /api/user/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { data: user } = await supabase
    .from('users').select('*').eq('email', email).maybeSingle();
  if (!user) throw new HttpError(401, 'Invalid credentials');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid credentials');

  const token = signAuthToken(user);
  res.json({ token, user: toUserProfile(user) });
}));

// PUT /api/user/profile
router.put('/profile', requireAuth, asyncHandler(async (req, res) => {
  const patch = profileUpdateSchema.parse(req.body);
  const { data: user, error } = await supabase
    .from('users')
    .update({ name: patch.name, avatar_url: patch.avatarUrl ?? null })
    .eq('id', req.user.id)
    .select('*').single();
  if (error) throw error;
  res.json(toUserProfile(user));
}));

// GET /api/user/verify?token=...
router.get('/verify', asyncHandler(async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!token) throw new HttpError(400, 'Missing token');

  const { data: user } = await supabase
    .from('users').select('*').eq('verification_token', token).maybeSingle();
  if (!user) throw new HttpError(400, 'Invalid or expired verification token');

  const { error } = await supabase
    .from('users')
    .update({ email_verified: true, verification_token: null })
    .eq('id', user.id);
  if (error) throw error;
  res.json({ message: 'Email verified!' });
}));

// POST /api/user/forgot-password
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = forgotSchema.parse(req.body);
  const { data: user } = await supabase
    .from('users').select('id,email').eq('email', email).maybeSingle();

  // Respond 200 regardless of match, to avoid enumeration.
  if (user) {
    const resetToken = signScopedToken({ sub: user.id, purpose: 'pwreset' }, '1h');
    await supabase.from('users')
      .update({
        password_reset_token: resetToken,
        password_reset_expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .eq('id', user.id);
    const resetUrl = `${env.appUrl}/reset-password/${resetToken}`;
    if (env.nodeEnv !== 'production') console.log('[dev] reset link:', resetUrl);
  }
  res.json({ message: 'If that email exists, a reset link has been sent.' });
}));

// POST /api/user/reset-password/:token
router.post('/reset-password/:token', asyncHandler(async (req, res) => {
  const { password } = resetSchema.parse(req.body);
  const { token } = req.params;

  let payload;
  try { payload = verifyScopedToken(token); }
  catch { throw new HttpError(400, 'Invalid or expired reset token'); }
  if (payload.purpose !== 'pwreset') throw new HttpError(400, 'Invalid token');

  const { data: user } = await supabase
    .from('users').select('*').eq('id', payload.sub).maybeSingle();
  if (!user || user.password_reset_token !== token) {
    throw new HttpError(400, 'Invalid or expired reset token');
  }

  const password_hash = await bcrypt.hash(password, 12);
  await supabase.from('users')
    .update({
      password_hash,
      password_reset_token: null,
      password_reset_expires: null,
    })
    .eq('id', user.id);
  res.json({ message: 'Password updated.' });
}));

export default router;
