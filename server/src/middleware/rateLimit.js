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

// Per-user (falls back to IP) cap for checkout/portal endpoints. Keeps a
// misbehaving client from spamming Stripe Session creation. The webhook
// receiver is deliberately NOT limited — Stripe retries on rejection.
export const billingLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  message: 'Too many billing requests. Please try again in a few minutes.',
});
