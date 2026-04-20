import cors from 'cors';
import { env } from '../config/env.js';
import { HttpError } from '../utils/async.js';

const allowlist = new Set(env.corsOrigin);

export const corsMiddleware = cors({
  origin(origin, cb) {
    // Non-browser clients (curl, server-to-server) send no Origin header.
    if (!origin) return cb(null, true);
    if (allowlist.has(origin)) return cb(null, true);
    cb(new HttpError(403, 'Origin not allowed by CORS'));
  },
  credentials: true,
});
