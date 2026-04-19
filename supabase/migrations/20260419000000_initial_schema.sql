-- =====================================================================
-- Qwiksell initial schema — Supabase (Postgres)
-- Replaces prior MongoDB model. UUID primary keys, snake_case columns.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- users
--   Owns authentication material + public profile fields.
--   We do NOT use Supabase Auth (auth.users) because the Angular frontend
--   decodes the JWT body directly and expects an `id` claim. A custom
--   JWT signed by the backend is issued on login/register.
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id                     uuid primary key default gen_random_uuid(),
  email                  text not null unique,
  password_hash          text not null,
  name                   text not null,
  avatar_url             text,
  email_verified         boolean not null default false,
  verification_token     text,
  password_reset_token   text,
  password_reset_expires timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists users_email_idx on public.users (lower(email));

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.users(id) on delete cascade,
  name        text not null,
  description text not null,
  price       numeric(12,2) not null check (price >= 0),
  category    text not null,
  condition   text,
  image_url   text not null,
  image_urls  text[] not null default '{}',
  sold        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists products_owner_idx       on public.products (owner_id);
create index if not exists products_category_idx    on public.products (category);
create index if not exists products_created_at_idx  on public.products (created_at desc);
create index if not exists products_price_idx       on public.products (price);
create index if not exists products_sold_idx        on public.products (sold);
-- Basic full-text search across name + description
create index if not exists products_search_idx
  on public.products using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

-- ---------------------------------------------------------------------
-- favorites  (many-to-many join: user <-> product)
-- ---------------------------------------------------------------------
create table if not exists public.favorites (
  user_id    uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists favorites_user_idx on public.favorites (user_id);

-- ---------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------
create table if not exists public.offers (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id   uuid not null references public.users(id) on delete cascade,
  seller_id  uuid not null references public.users(id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  message    text,
  status     text not null default 'pending'
             check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_seller_idx  on public.offers (seller_id);
create index if not exists offers_buyer_idx   on public.offers (buyer_id);
create index if not exists offers_product_idx on public.offers (product_id);

-- ---------------------------------------------------------------------
-- messages
--   Threaded by (sender_id, recipient_id, product_id) pair.
--   `type` = 'text' | 'offer'. If 'offer', offer_id points to the related offer row.
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  content      text not null,
  type         text not null default 'text' check (type in ('text','offer')),
  offer_id     uuid references public.offers(id) on delete set null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists messages_recipient_unread_idx
  on public.messages (recipient_id) where read_at is null;
create index if not exists messages_thread_idx
  on public.messages (product_id, sender_id, recipient_id, created_at);
create index if not exists messages_inbox_idx
  on public.messages (recipient_id, created_at desc);

-- ---------------------------------------------------------------------
-- ratings (seller ratings — one per reviewer/seller pair)
-- ---------------------------------------------------------------------
create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.users(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete cascade,
  stars       int  not null check (stars between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (seller_id, reviewer_id),
  check (seller_id <> reviewer_id)
);
create index if not exists ratings_seller_idx on public.ratings (seller_id);

-- ---------------------------------------------------------------------
-- reports  (product reports — dedup on (product, reporter))
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),
  unique (product_id, reporter_id)
);

-- ---------------------------------------------------------------------
-- orders
--   items/shipping_address kept as JSONB to match the checkout payload
--   (snapshot at purchase time — decouples from product mutation).
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid not null references public.users(id) on delete cascade,
  items            jsonb not null,
  total            numeric(12,2) not null check (total >= 0),
  shipping_address jsonb not null,
  status           text not null default 'pending'
                   check (status in ('pending','paid','shipped','delivered','cancelled')),
  created_at       timestamptz not null default now()
);
create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_users_updated_at') then
    create trigger trg_users_updated_at    before update on public.users    for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_products_updated_at') then
    create trigger trg_products_updated_at before update on public.products for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_offers_updated_at') then
    create trigger trg_offers_updated_at   before update on public.offers   for each row execute function public.set_updated_at();
  end if;
end $$;
