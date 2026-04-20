-- =====================================================================
-- Tartak — Stripe wiring.
--
-- Additive only: add Stripe Price ID columns to the catalog tables the
-- billing routes need to look up, and a dedicated stripe_events table
-- that guarantees webhook idempotency via the primary key.
-- =====================================================================

-- Catalog columns: filled in manually after Stripe Dashboard setup.
alter table public.subscription_plans add column if not exists stripe_price_id text;
alter table public.addon_services     add column if not exists stripe_price_id text;

-- Processed-event log. The webhook upserts into this before dispatching
-- so duplicate deliveries (Stripe retries) are a no-op.
create table if not exists public.stripe_events (
  id            text primary key,                     -- Stripe event id (evt_...)
  type          text not null,
  processed_at  timestamptz not null default now()
);

-- Service-role only. No policies — the webhook runs with the shared
-- supabase client (service-role key) and the table is invisible to
-- end-users over PostgREST.
alter table public.stripe_events enable row level security;
