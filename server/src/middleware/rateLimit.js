import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const jsonMessage = (message) => ({ message });

function makeLimiter({ windowMs, max, keyGenerator, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => res.status(429).json(jsonMessage(message)),
  });
}

export const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many attempts. Please try again in a few minutes.',
});

export const uploadLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  message: 'Upload limit reached. Try again later.',
});

export const globalLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests. Please slow down.',
});

export const storefrontReadLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  max: 300,
  message: 'Too many storefront requests. Please slow down.',
});
