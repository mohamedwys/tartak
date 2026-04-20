import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { corsMiddleware } from './middleware/cors.js';
import { httpLogger } from './middleware/logger.js';
import { notFound, errorHandler } from './middleware/error.js';
import {
  authLimiter,
  uploadLimiter,
  globalLimiter,
} from './middleware/rateLimit.js';
import { requireAuth } from './middleware/auth.js';

import authRoutes      from './routes/auth.routes.js';
import usersRoutes     from './routes/users.routes.js';
import productsRoutes  from './routes/products.routes.js';
import favoritesRoutes from './routes/favorites.routes.js';
import messagesRoutes  from './routes/messages.routes.js';
import offersRoutes    from './routes/offers.routes.js';
import ratingsRoutes   from './routes/ratings.routes.js';
import reportsRoutes   from './routes/reports.routes.js';
import ordersRoutes    from './routes/orders.routes.js';
import uploadRoutes    from './routes/upload.routes.js';
import orgsRoutes      from './routes/orgs.routes.js';
import storefrontsRoutes from './routes/storefronts.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import homeRoutes       from './routes/home.routes.js';
import { plansRouter, addonsRouter } from './routes/subscriptions.routes.js';

const app = express();

// Behind a proxy/load balancer, trust the first hop so req.ip reflects the
// real client (rate limiter keys on it).
app.set('trust proxy', 1);

app.use(helmet());
app.use(corsMiddleware);
app.use(httpLogger);
app.use(express.json({ limit: '2mb' }));

app.use(globalLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Stricter limits on credential-facing endpoints.
app.post('/api/user/login',              authLimiter);
app.post('/api/user/register',           authLimiter);
app.post('/api/user/forgot-password',    authLimiter);
app.post('/api/user/reset-password/*',   authLimiter);

// Upload is per-user; auth must run first so req.user is populated.
app.use('/api/upload', requireAuth, uploadLimiter);

// Auth is mounted at /api/user/* (register, login, profile, verify, etc)
// Public /api/user/:id/profile is handled by the users router.
app.use('/api/user', authRoutes);
app.use('/api/user', usersRoutes);

app.use('/api/products',  productsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/messages',  messagesRoutes);
app.use('/api/offers',    offersRoutes);
app.use('/api/ratings',   ratingsRoutes);
app.use('/api/reports',   reportsRoutes);
app.use('/api/orders',    ordersRoutes);
app.use('/api/upload',    uploadRoutes);
app.use('/api/orgs',      orgsRoutes);
app.use('/api/storefronts', storefrontsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/home',       homeRoutes);
app.use('/api/subscription-plans', plansRouter);
app.use('/api/addon-services',     addonsRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[tartak-api] listening on :${env.port} (${env.nodeEnv})`);
});
