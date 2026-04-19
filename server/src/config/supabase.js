import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client: used by the backend to bypass RLS.
// Never ship this key to the browser.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
