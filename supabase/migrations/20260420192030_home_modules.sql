-- =====================================================================
-- Tartak — Pro home composed surface (banners + tiles).
--
-- Additive migration. Introduces two content tables whose rows are
-- seeded here and (for now) edited via direct SQL. An admin CRUD UI
-- will come in a later step.
--
-- Public read-only RLS; no write policies (service-role only).
-- =====================================================================

-- ---------------------------------------------------------------------
-- home_banners — hero carousel items
-- ---------------------------------------------------------------------
create table if not exists public.home_banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  cta_label   text,
  cta_url     text,
  image_url   text,
  bg_color    text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists home_banners_sort_order_idx on public.home_banners (sort_order);
create index if not exists home_banners_active_idx     on public.home_banners (active);

-- ---------------------------------------------------------------------
-- home_tiles — quick-access tile row
-- ---------------------------------------------------------------------
create table if not exists public.home_tiles (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  icon_url    text,
  target_url  text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists home_tiles_sort_order_idx on public.home_tiles (sort_order);

-- ---------------------------------------------------------------------
-- updated_at trigger on home_banners — reuses public.set_updated_at()
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_home_banners_updated_at') then
    create trigger trg_home_banners_updated_at
      before update on public.home_banners
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- RLS — public read, no write policies (service-role only mutates)
-- ---------------------------------------------------------------------
alter table public.home_banners enable row level security;
alter table public.home_tiles   enable row level security;

drop policy if exists home_banners_read_all on public.home_banners;
create policy home_banners_read_all on public.home_banners for select using (true);

drop policy if exists home_tiles_read_all on public.home_tiles;
create policy home_tiles_read_all on public.home_tiles for select using (true);

-- ---------------------------------------------------------------------
-- Seeds
--   Guarded by a table-empty check so re-applying the migration on an
--   environment that already has rows is a no-op instead of duplicating.
-- ---------------------------------------------------------------------
insert into public.home_banners (title, subtitle, cta_label, cta_url, bg_color, sort_order)
select * from (values
  ('Discover local brands', 'Independent sellers near you',     'Explore',   '/',                     '#8c1c13', 1),
  ('Tech essentials',       'Laptops, phones and accessories',  'Shop now',  '/c/electronics',        '#3d6b4a', 2),
  ('Back to school',        'Notebooks, backpacks and more',    'Shop now',  '/c/stationery-office',  '#bf4342', 3),
  ('Elevate your space',    'Home and kitchen edit',            'Discover',  '/c/home-kitchen',       '#735751', 4)
) as v(title, subtitle, cta_label, cta_url, bg_color, sort_order)
where not exists (select 1 from public.home_banners);

insert into public.home_tiles (label, target_url, sort_order)
select * from (values
  ('Mobiles',          '/c/mobiles-accessories',  1),
  ('Laptops',          '/c/laptops-desktops',     2),
  ('Electronics',      '/c/electronics',          3),
  ('Beauty',           '/c/beauty-fragrance',     4),
  ('Home',             '/c/home-kitchen',         5),
  ('Grocery',          '/c/grocery',              6),
  ('Women''s Fashion', '/c/womens-fashion',       7),
  ('Men''s Fashion',   '/c/mens-fashion',         8),
  ('Toys',             '/c/toys',                 9),
  ('Sports',           '/c/sports-outdoors',      10)
) as v(label, target_url, sort_order)
where not exists (select 1 from public.home_tiles);
