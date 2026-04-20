import { ZodError } from 'zod';
import { env } from '../config/env.js';

const isProd = env.nodeEnv === 'production';

function baseBody(req) {
  const id = req?.id ?? req?.headers?.['x-request-id'];
  return id ? { request_id: String(id) } : {};
}

export function notFound(req, res) {
  res.status(404).json({ ...baseBody(req), message: 'Not found' });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      ...baseBody(req),
      message: 'Validation failed',
      errors: err.flatten(),
    });
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;
  const clientMessage =
    status >= 500
      ? 'Internal server error'
      : (err?.message ?? 'Request failed');

  const body = { ...baseBody(req), message: clientMessage };
  if (err?.extra && status < 500) body.extra = err.extra;

  if (!isProd && err?.stack) body.stack = err.stack;

  if (status >= 500) {
    if (req?.log?.error) req.log.error({ err }, 'unhandled error');
    else console.error('[error]', err);
  }
  res.status(status).json(body);
}
