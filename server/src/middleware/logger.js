import crypto from 'node:crypto';
import pinoHttp from 'pino-http';
import { env } from '../config/env.js';

const isProd = env.nodeEnv === 'production';

export const httpLogger = pinoHttp({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id = (typeof incoming === 'string' && incoming.trim()) || crypto.randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res, responseTime) =>
    `${req.method} ${req.url} ${res.statusCode} ${Math.round(responseTime)}ms`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  serializers: {
    req: (req) => ({
      method: req.method,
      path: req.url,
      request_id: req.id,
    }),
    res: (res) => ({ status: res.statusCode }),
  },
});
