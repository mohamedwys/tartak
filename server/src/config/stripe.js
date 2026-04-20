import Stripe from 'stripe';
import { env } from './env.js';
import { HttpError } from '../utils/async.js';

// Lazy-init pattern: the SDK is only constructed when a secret key is
// present. This lets the rest of the app boot in environments that
// haven't wired Stripe yet (local dev, preview envs), while any caller
// that actually needs Stripe fails fast with a 503.
export const stripe = env.stripeSecretKey
  ? new Stripe(env.stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

export function requireStripe() {
  if (!stripe) {
    throw new HttpError(503, 'Billing is not configured on this server');
  }
  return stripe;
}
