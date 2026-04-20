import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseCorsOrigin(raw) {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const corsOrigin = parseCorsOrigin(process.env.CORS_ORIGIN);

// Fail-secure in production (empty allowlist = deny all browser origins),
// but fall back to localhost in dev so a fresh clone "just works".
if (corsOrigin.length === 0) {
  if (nodeEnv === 'production') {
    console.warn(
      '[env] CORS_ORIGIN is empty in production — all browser requests will be rejected.',
    );
  } else {
    corsOrigin.push('http://localhost:4200');
    console.info('[env] CORS_ORIGIN unset; defaulting to http://localhost:4200 (dev only).');
  }
}

export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv,
  corsOrigin,

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'product-images',

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  appUrl: process.env.APP_URL ?? 'http://localhost:4200',
};
