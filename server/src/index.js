import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { notFound, errorHandler } from './middleware/error.js';

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

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

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

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[qwiksell-api] listening on :${env.port} (${env.nodeEnv})`);
});
