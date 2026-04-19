-- =====================================================================
-- Row-Level Security
--
-- All application reads/writes go through the Node backend using the
-- Supabase service-role key, which bypasses RLS. RLS here is a
-- *defense-in-depth* layer in case the anon key is ever exposed or the
-- frontend is later migrated to call Supabase directly.
--
-- Policies are written against `auth.uid()` — they apply to any future
-- direct-from-client usage with Supabase Auth. Service-role calls from
-- the backend are unaffected.
-- =====================================================================

alter table public.users      enable row level security;
alter table public.products   enable row level security;
alter table public.favorites  enable row level security;
alter table public.offers     enable row level security;
alter table public.messages   enable row level security;
alter table public.ratings    enable row level security;
alter table public.reports    enable row level security;
alter table public.orders     enable row level security;

-- ---- users ----------------------------------------------------------
drop policy if exists users_read_public on public.users;
create policy users_read_public on public.users
  for select using (true);  -- public profile info is readable

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---- products -------------------------------------------------------
drop policy if exists products_read_all on public.products;
create policy products_read_all on public.products for select using (true);

drop policy if exists products_insert_own on public.products;
create policy products_insert_own on public.products
  for insert with check (auth.uid() = owner_id);

drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists products_delete_own on public.products;
create policy products_delete_own on public.products
  for delete using (auth.uid() = owner_id);

-- ---- favorites ------------------------------------------------------
drop policy if exists favorites_self on public.favorites;
create policy favorites_self on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- offers ---------------------------------------------------------
drop policy if exists offers_party_read on public.offers;
create policy offers_party_read on public.offers
  for select using (auth.uid() in (buyer_id, seller_id));

drop policy if exists offers_buyer_insert on public.offers;
create policy offers_buyer_insert on public.offers
  for insert with check (auth.uid() = buyer_id);

drop policy if exists offers_seller_update on public.offers;
create policy offers_seller_update on public.offers
  for update using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

-- ---- messages -------------------------------------------------------
drop policy if exists messages_party_read on public.messages;
create policy messages_party_read on public.messages
  for select using (auth.uid() in (sender_id, recipient_id));

drop policy if exists messages_sender_insert on public.messages;
create policy messages_sender_insert on public.messages
  for insert with check (auth.uid() = sender_id);

drop policy if exists messages_recipient_update on public.messages;
create policy messages_recipient_update on public.messages
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- ---- ratings --------------------------------------------------------
drop policy if exists ratings_read_all on public.ratings;
create policy ratings_read_all on public.ratings for select using (true);

drop policy if exists ratings_reviewer_write on public.ratings;
create policy ratings_reviewer_write on public.ratings
  for insert with check (auth.uid() = reviewer_id);

-- ---- reports --------------------------------------------------------
drop policy if exists reports_self_insert on public.reports;
create policy reports_self_insert on public.reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists reports_self_read on public.reports;
create policy reports_self_read on public.reports
  for select using (auth.uid() = reporter_id);

-- ---- orders ---------------------------------------------------------
drop policy if exists orders_buyer_read on public.orders;
create policy orders_buyer_read on public.orders
  for select using (auth.uid() = buyer_id);

drop policy if exists orders_buyer_insert on public.orders;
create policy orders_buyer_insert on public.orders
  for insert with check (auth.uid() = buyer_id);
