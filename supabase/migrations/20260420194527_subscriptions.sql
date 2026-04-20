-- =====================================================================
-- Tartak — subscription plans + add-on services scaffolding.
--
-- Two-plan foundation (Free + Pro) priced in Moroccan Dirham (MAD) and
-- the first optional paid add-on (homepage feature). Payments are NOT
-- wired yet — the schema simply models the entities so a later Stripe
-- drop-in can populate stripe_* fields and flip subscription status.
--
-- Additive + idempotent. Prices live in minor units (centimes) as
-- integers so the shape generalizes to other currencies later without
-- a round-trip through floats. A `currency` column keeps the door open
-- for GBP/EUR/etc. without a future migration.
-- =====================================================================

-- subscription_plans --------------------------------------------------
create table if not exists public.subscription_plans (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  price_minor         int not null default 0 check (price_minor >= 0),
  currency            text not null default 'MAD',
  billing_interval    text not null default 'month'
                      check (billing_interval in ('month','year','one_time')),
  features            jsonb not null default '{}'::jsonb,
  active              boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- org_subscriptions ---------------------------------------------------
create table if not exists public.org_subscriptions (
  org_id                  uuid primary key references public.organizations(id) on delete cascade,
  plan_slug               text not null references public.subscription_plans(slug) on update cascade,
  status                  text not null default 'active'
                          check (status in ('active','cancelled','past_due','trialing')),
  started_at              timestamptz not null default now(),
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- addon_services ------------------------------------------------------
create table if not exists public.addon_services (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  description     text,
  price_minor     int not null default 0 check (price_minor >= 0),
  currency        text not null default 'MAD',
  type            text not null default 'one_time'
                  check (type in ('one_time','recurring')),
  duration_days   int,
  features        jsonb not null default '{}'::jsonb,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- org_addons ----------------------------------------------------------
create table if not exists public.org_addons (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  addon_slug      text not null references public.addon_services(slug) on update cascade,
  -- Optional: a particular product this add-on applies to (e.g. homepage-feature
  -- picks one listing to boost). null when the add-on is org-wide.
  product_id      uuid references public.products(id) on delete set null,
  status          text not null default 'active'
                  check (status in ('active','expired','cancelled')),
  started_at      timestamptz not null default now(),
  ends_at         timestamptz,
  -- Payment provider references, filled in when Stripe lands.
  stripe_payment_intent_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------
create index if not exists org_subscriptions_plan_idx   on public.org_subscriptions (plan_slug);
create index if not exists org_addons_org_idx           on public.org_addons (org_id);
create index if not exists org_addons_status_ends_idx   on public.org_addons (status, ends_at);
create index if not exists addon_services_active_idx    on public.addon_services (active);

-- updated_at triggers (reuse public.set_updated_at()) -----------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_subscription_plans_updated_at') then
    create trigger trg_subscription_plans_updated_at
      before update on public.subscription_plans
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_subscriptions_updated_at') then
    create trigger trg_org_subscriptions_updated_at
      before update on public.org_subscriptions
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_addon_services_updated_at') then
    create trigger trg_addon_services_updated_at
      before update on public.addon_services
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_org_addons_updated_at') then
    create trigger trg_org_addons_updated_at
      before update on public.org_addons
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS — plans and add-on catalog are public; membership tables are
-- service-role-only (the API enforces per-org access via requireOrgRole).
alter table public.subscription_plans enable row level security;
alter table public.org_subscriptions  enable row level security;
alter table public.addon_services     enable row level security;
alter table public.org_addons         enable row level security;

drop policy if exists subscription_plans_read_all on public.subscription_plans;
create policy subscription_plans_read_all on public.subscription_plans
  for select using (true);

drop policy if exists addon_services_read_all on public.addon_services;
create policy addon_services_read_all on public.addon_services
  for select using (true);

-- org_subscriptions + org_addons: intentionally no policies = service-role only.

-- ---------------------------------------------------------------------
-- Seeds (idempotent)
-- ---------------------------------------------------------------------

-- Plans: Free forever + Pro at 350 MAD / month. listing_limit=null on Pro
-- means "unlimited" — the server treats a non-number value as no cap.
insert into public.subscription_plans (slug, name, price_minor, currency, billing_interval, features, sort_order) values
  ('free', 'Free', 0, 'MAD', 'month',
    '{"listing_limit":10,"verified_badge":false,"advanced_analytics":false,"priority_support":false}'::jsonb,
    1),
  ('pro',  'Pro',  35000, 'MAD', 'month',
    '{"listing_limit":null,"verified_badge":true,"advanced_analytics":true,"priority_support":true}'::jsonb,
    2)
on conflict (slug) do nothing;

-- Add-on services: one homepage-feature slot, 100 MAD / 7 days. Future
-- add-ons (category boosts, verified badge rush, etc) land here.
insert into public.addon_services (slug, name, description, price_minor, currency, type, duration_days, features, sort_order) values
  ('homepage-feature',
   'Homepage Feature',
   'Pin one of your listings in the Tartak homepage hero for 7 days. Boosts visibility across the entire Pro catalog.',
   10000, 'MAD', 'one_time', 7,
   '{"placement":"home_hero","slots":1}'::jsonb,
   1)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Backfill: every pre-existing org lands on the Free plan. Idempotent
-- via LEFT JOIN — re-running this migration (or a later data repair)
-- won't duplicate rows thanks to the primary key on org_id.
-- ---------------------------------------------------------------------
insert into public.org_subscriptions (org_id, plan_slug, status, started_at)
  select o.id, 'free', 'active', now()
  from public.organizations o
  left join public.org_subscriptions s on s.org_id = o.id
  where s.org_id is null;
