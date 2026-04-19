import { ZodError } from 'zod';

export function notFound(_req, res) {
  res.status(404).json({ message: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.flatten(),
    });
  }
  const status = err.status ?? 500;
  const body = { message: err.message ?? 'Internal server error' };
  if (err.extra) body.extra = err.extra;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json(body);
}
