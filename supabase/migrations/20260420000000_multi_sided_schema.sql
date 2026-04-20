-- =====================================================================
-- Qwiksell — multi-sided marketplace schema (additive migration)
-- Orgs, storefronts, variants, categories, locations, moderation, analytics.
--
-- /* MIGRATION NOTES */
--   * Additive only. No destructive schema changes. Safe on live data.
--     Expected duration <30s on ~1M products.
--   * Existing `users` rows naturally fall to account_type = 'individual'
--     via the column default.
--   * Existing `products` rows naturally fall to org_id = NULL (C2C
--     listing by an individual) and status = 'active' via defaults.
--   * The legacy `products.category` text column is intentionally kept
--     for back-compat. The new `products.category_id` FK is optional
--     until a backfill script maps legacy text categories to rows in
--     the new `categories` table. That backfill is OUT of scope here.
--   * No PostGIS. `products.lat` / `products.lng` are plain
--     `double precision` with a composite btree on (country, city) to
--     serve coarse geo filtering. If radius/bounding-box search becomes
--     a hotspot, a follow-up migration can enable PostGIS + GIST;
--     PostGIS is a heavyweight extension (install/maintain cost, larger
--     images, upgrade friction) so we defer it until there's demand.
--   * No pg_trgm either — existing full-text GIN on products already
--     covers name/description search.
--   * Payments, fulfillment, invoices, quotes, promotions, currency,
--     tax_class, MOQ and bulk pricing are OUT of scope and NOT added
--     here. The existing `orders` table is untouched on purpose.
-- =====================================================================

-- ---------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------

-- organizations -------------------------------------------------------
create table if not exists public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  type            text not null default 'b2c'
                  check (type in ('b2c','b2b','both')),
  kyb_status      text not null default 'unverified'
                  check (kyb_status in ('unverified','pending','verified','rejected')),
  tax_id          text,
  billing_address jsonb,
  logo_url        text,
  cover_url       text,
  bio             text,
  website         text,
  support_email   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists organizations_type_idx       on public.organizations (type);
create index if not exists organizations_kyb_status_idx on public.organizations (kyb_status);

-- org_members ---------------------------------------------------------
create table if not exists public.org_members (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references public.users(id)         on delete cascade,
  role        text not null default 'agent'
              check (role in ('owner','admin','manager','agent')),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on public.org_members (user_id);
create index if not exists org_members_org_idx  on public.org_members (org_id);

-- categories ----------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.categories(id) on delete set null,
  slug       text not null unique,
  name       text not null,
  icon       text,
  sort_order int  not null default 0
);
create index if not exists categories_parent_idx     on public.categories (parent_id);
create index if not exists categories_sort_order_idx on public.categories (sort_order);

-- product_variants ----------------------------------------------------
create table if not exists public.product_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  sku          text not null unique,
  attributes   jsonb not null default '{}'::jsonb,
  price        numeric(12,2) not null check (price >= 0),
  stock        int not null default 0 check (stock >= 0),
  weight_grams int,
  created_at   timestamptz not null default now()
);
create index if not exists product_variants_product_idx      on public.product_variants (product_id);
create index if not exists product_variants_in_stock_idx     on public.product_variants (product_id) where stock > 0;

-- storefronts ---------------------------------------------------------
create table if not exists public.storefronts (
  org_id   uuid primary key references public.organizations(id) on delete cascade,
  slug     text not null unique,
  theme    jsonb not null default '{}'::jsonb,
  seo      jsonb not null default '{}'::jsonb,
  policies jsonb not null default '{}'::jsonb
);

-- saved_searches ------------------------------------------------------
create table if not exists public.saved_searches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  name              text not null,
  query             jsonb not null default '{}'::jsonb,
  notify            text not null default 'none'
                    check (notify in ('none','daily','instant')),
  last_notified_at  timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists saved_searches_user_idx   on public.saved_searches (user_id);
create index if not exists saved_searches_notify_idx on public.saved_searches (notify) where notify <> 'none';

-- review_responses ----------------------------------------------------
create table if not exists public.review_responses (
  rating_id         uuid primary key references public.ratings(id) on delete cascade,
  responder_user_id uuid not null references public.users(id)      on delete cascade,
  content           text not null,
  created_at        timestamptz not null default now()
);
create index if not exists review_responses_responder_idx on public.review_responses (responder_user_id);

-- admin_users ---------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references public.users(id) on delete cascade,
  role       text not null default 'moderator'
             check (role in ('admin','moderator','support')),
  granted_by uuid references public.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
create index if not exists admin_users_role_idx on public.admin_users (role);

-- audit_logs ----------------------------------------------------------
create table if not exists public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references public.users(id)         on delete set null,
  org_id         uuid references public.organizations(id) on delete set null,
  action         text not null,
  target_table   text not null,
  target_id      uuid,
  diff           jsonb,
  ip             inet,
  user_agent     text,
  created_at     timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx         on public.audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_org_idx           on public.audit_logs (org_id, created_at desc);
create index if not exists audit_logs_target_idx        on public.audit_logs (target_table, target_id);
create index if not exists audit_logs_created_at_idx    on public.audit_logs (created_at desc);

-- events --------------------------------------------------------------
create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references public.users(id)         on delete set null,
  org_id         uuid references public.organizations(id) on delete set null,
  name           text not null,
  properties     jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists events_name_created_at_idx  on public.events (name, created_at desc);
create index if not exists events_actor_idx            on public.events (actor_user_id, created_at desc);
create index if not exists events_org_idx              on public.events (org_id, created_at desc);
create index if not exists events_created_at_idx       on public.events (created_at desc);

-- ---------------------------------------------------------------------
-- ALTERs to existing tables (additive, all columns nullable or defaulted)
-- ---------------------------------------------------------------------

-- users ---------------------------------------------------------------
alter table public.users
  add column if not exists account_type     text not null default 'individual'
                                            check (account_type in ('individual','business')),
  add column if not exists current_org_id   uuid references public.organizations(id) on delete set null,
  add column if not exists phone            text,
  add column if not exists phone_verified   boolean not null default false,
  add column if not exists locale           text not null default 'en',
  add column if not exists last_login_at    timestamptz;
create index if not exists users_current_org_idx   on public.users (current_org_id);
create index if not exists users_account_type_idx  on public.users (account_type);

-- products ------------------------------------------------------------
alter table public.products
  add column if not exists org_id        uuid references public.organizations(id) on delete set null,
  add column if not exists status        text not null default 'active'
                                         check (status in ('draft','active','paused','sold','removed')),
  add column if not exists pricing_mode  text not null default 'fixed'
                                         check (pricing_mode in ('fixed','offer','contact')),
  add column if not exists city          text,
  add column if not exists region        text,
  add column if not exists country       char(2),
  add column if not exists postal_code   text,
  add column if not exists lat           double precision,
  add column if not exists lng           double precision,
  add column if not exists views_count   int not null default 0,
  add column if not exists category_id   uuid references public.categories(id) on delete set null,
  add column if not exists attributes    jsonb not null default '{}'::jsonb,
  add column if not exists brand         text;
create index if not exists products_org_idx              on public.products (org_id);
create index if not exists products_category_id_idx      on public.products (category_id);
create index if not exists products_status_created_idx   on public.products (status, created_at desc);
create index if not exists products_country_city_idx     on public.products (country, city);
create index if not exists products_brand_idx            on public.products (brand);

-- reports -------------------------------------------------------------
alter table public.reports
  add column if not exists status        text not null default 'pending'
                                         check (status in ('pending','reviewing','resolved','dismissed')),
  add column if not exists resolved_by   uuid references public.users(id) on delete set null,
  add column if not exists resolved_at   timestamptz,
  add column if not exists action_taken  text;
create index if not exists reports_status_idx      on public.reports (status);
create index if not exists reports_resolved_by_idx on public.reports (resolved_by);

-- ratings -------------------------------------------------------------
alter table public.ratings
  add column if not exists helpful_count int not null default 0;

-- ---------------------------------------------------------------------
-- updated_at trigger on new tables that carry the column
-- (reuses public.set_updated_at() from the initial migration)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_organizations_updated_at') then
    create trigger trg_organizations_updated_at
      before update on public.organizations
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- RLS — enable on every new table
-- ---------------------------------------------------------------------
alter table public.organizations    enable row level security;
alter table public.org_members      enable row level security;
alter table public.categories       enable row level security;
alter table public.product_variants enable row level security;
alter table public.storefronts      enable row level security;
alter table public.saved_searches   enable row level security;
alter table public.review_responses enable row level security;
alter table public.admin_users      enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.events           enable row level security;

-- organizations — public read, owners/admins write via org_members ----
drop policy if exists organizations_read_all on public.organizations;
create policy organizations_read_all on public.organizations
  for select using (true);

drop policy if exists organizations_insert_auth on public.organizations;
create policy organizations_insert_auth on public.organizations
  for insert with check (auth.uid() is not null);

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
  for update using (
    exists (
      select 1 from public.org_members m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.org_members m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

drop policy if exists organizations_delete_owner on public.organizations;
create policy organizations_delete_owner on public.organizations
  for delete using (
    exists (
      select 1 from public.org_members m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- org_members — only members of that org can read --------------------
drop policy if exists org_members_member_read on public.org_members;
create policy org_members_member_read on public.org_members
  for select using (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists org_members_admin_write on public.org_members;
create policy org_members_admin_write on public.org_members
  for all using (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.org_members m
      where m.org_id = org_members.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- categories — public read. Writes handled by service-role only. -----
drop policy if exists categories_read_all on public.categories;
create policy categories_read_all on public.categories
  for select using (true);

-- product_variants — public read. Writes: product owner or org admin -
drop policy if exists product_variants_read_all on public.product_variants;
create policy product_variants_read_all on public.product_variants
  for select using (true);

drop policy if exists product_variants_write_owner on public.product_variants;
create policy product_variants_write_owner on public.product_variants
  for all using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (
          p.owner_id = auth.uid()
          or (
            p.org_id is not null and exists (
              select 1 from public.org_members m
              where m.org_id = p.org_id
                and m.user_id = auth.uid()
                and m.role in ('owner','admin','manager')
            )
          )
        )
    )
  ) with check (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and (
          p.owner_id = auth.uid()
          or (
            p.org_id is not null and exists (
              select 1 from public.org_members m
              where m.org_id = p.org_id
                and m.user_id = auth.uid()
                and m.role in ('owner','admin','manager')
            )
          )
        )
    )
  );

-- storefronts — public read. Writes: org owners/admins ---------------
drop policy if exists storefronts_read_all on public.storefronts;
create policy storefronts_read_all on public.storefronts
  for select using (true);

drop policy if exists storefronts_admin_write on public.storefronts;
create policy storefronts_admin_write on public.storefronts
  for all using (
    exists (
      select 1 from public.org_members m
      where m.org_id = storefronts.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.org_members m
      where m.org_id = storefronts.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- saved_searches — owner only ----------------------------------------
drop policy if exists saved_searches_owner_all on public.saved_searches;
create policy saved_searches_owner_all on public.saved_searches
  for all using (auth.uid() = user_id)
           with check (auth.uid() = user_id);

-- review_responses — public read; insert by the seller being reviewed
-- (or by an org member managing products owned by that seller) -------
drop policy if exists review_responses_read_all on public.review_responses;
create policy review_responses_read_all on public.review_responses
  for select using (true);

drop policy if exists review_responses_seller_insert on public.review_responses;
create policy review_responses_seller_insert on public.review_responses
  for insert with check (
    auth.uid() = responder_user_id
    and exists (
      select 1 from public.ratings r
      where r.id = review_responses.rating_id
        and (
          r.seller_id = auth.uid()
          or exists (
            select 1
            from public.products p
            join public.org_members m on m.org_id = p.org_id
            where p.owner_id = r.seller_id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin','manager')
          )
        )
    )
  );

drop policy if exists review_responses_seller_update on public.review_responses;
create policy review_responses_seller_update on public.review_responses
  for update using (auth.uid() = responder_user_id)
             with check (auth.uid() = responder_user_id);

drop policy if exists review_responses_seller_delete on public.review_responses;
create policy review_responses_seller_delete on public.review_responses
  for delete using (auth.uid() = responder_user_id);

-- admin_users — service-role only (no policies = deny for non-service)
-- RLS is enabled above; intentionally NO policies are defined so only
-- the service-role key (which bypasses RLS) can read or write.

-- audit_logs — readable by platform admins only ----------------------
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select using (
    exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid()
    )
  );

-- events — readable by platform admins only --------------------------
drop policy if exists events_admin_read on public.events;
create policy events_admin_read on public.events
  for select using (
    exists (
      select 1 from public.admin_users a
      where a.user_id = auth.uid()
    )
  );
