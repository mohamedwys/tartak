import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/async.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new HttpError(400, 'Only image files are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/upload
// Stores image in Supabase Storage; returns a public URL.
router.post('/', requireAuth, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No image uploaded');

  const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
  const key = `${req.user.id}/${crypto.randomUUID()}${ext}`;

  const { error } = await supabase.storage
    .from(env.supabaseStorageBucket)
    .upload(key, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
  if (error) throw new HttpError(500, `Storage upload failed: ${error.message}`);

  const { data: pub } = supabase.storage
    .from(env.supabaseStorageBucket)
    .getPublicUrl(key);

  // Frontend concatenates `baseUrl + response.url` when url is relative.
  // An absolute Supabase URL replaces that — the UploadService was updated
  // to pass absolute URLs straight through.
  res.json({ url: pub.publicUrl });
}));

export default router;
