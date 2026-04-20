import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { asyncHandler } from '../utils/async.js';
import { toSubscriptionPlan, toAddonService } from '../utils/mapping.js';

// Public plan + add-on catalog. No auth: the pricing page, the plan
// comparison, and any future signup wall all need to read this without
// a token. Reads go through the service-role client (RLS is already
// public-read on both tables, but using the shared client is simplest).

export const plansRouter = Router();
export const addonsRouter = Router();

// GET /api/subscription-plans
plansRouter.get('/', asyncHandler(async (_req, res) => {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  res.json((data ?? []).map(toSubscriptionPlan));
}));

// GET /api/addon-services
addonsRouter.get('/', asyncHandler(async (_req, res) => {
  const { data, error } = await supabase
    .from('addon_services')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  res.json((data ?? []).map(toAddonService));
}));

export default plansRouter;
