-- =====================================================================
-- Tartak — seed category taxonomy + backfill legacy text categories
--
-- /* NOTES */
--   * Additive + idempotent. Every INSERT uses ON CONFLICT (slug) DO NOTHING,
--     so re-running this migration is safe on live data.
--   * Seeds 14 top-level + ~71 sub-categories (≈85 rows total) matching a
--     Noon-parity taxonomy. Only one sub-level is seeded in this step;
--     deeper levels can be added later without breaking anything.
--   * Slug convention: kebab-case of the name, globally unique. Leaf names
--     that collide across parents are prefixed (e.g. mens-clothing vs
--     womens-clothing). sort_order = array index within its level, from 1.
--   * Backfill at the bottom maps the 7 legacy text categories used by the
--     old hardcoded picker into category_id FKs. `products.category` text
--     is intentionally NOT nulled — back-compat stays intact.
--   * RLS: public reads on `categories` are already allowed by the prior
--     migration. No policy changes required.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Top-level categories
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order) values
  ('electronics',       'Electronics',        null, 1) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('beauty-fragrance',  'Beauty & Fragrance', null, 2) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('home-kitchen',      'Home & Kitchen',     null, 3) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('grocery',           'Grocery',            null, 4) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('mens-fashion',      'Men''s Fashion',     null, 5) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('womens-fashion',    'Women''s Fashion',   null, 6) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('baby',              'Baby',               null, 7) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('toys',              'Toys',               null, 8) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('kids-fashion',      'Kids'' Fashion',     null, 9) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('sports-outdoors',   'Sports & Outdoors',  null, 10) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('health-nutrition',  'Health & Nutrition', null, 11) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('stationery-office', 'Stationery & Office', null, 12) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('books-media',       'Books & Media',      null, 13) on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order) values
  ('automotive',        'Automotive',         null, 14) on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Electronics
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'mobiles-accessories',  'Mobiles & Accessories',        id, 1 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'laptops-desktops',     'Laptops & Desktops',           id, 2 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'tablets-ereaders',     'Tablets & E-Readers',          id, 3 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'tv-audio-video',       'TV/Audio/Video',               id, 4 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'cameras-drones',       'Cameras & Drones',             id, 5 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'wearables-smart',      'Wearables & Smart Devices',    id, 6 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'gaming',               'Gaming',                       id, 7 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'networking-storage',   'Networking & Storage',         id, 8 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'printers-office-electronics', 'Printers & Office Electronics', id, 9 from public.categories where slug = 'electronics'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Beauty & Fragrance
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'skincare',              'Skincare',                  id, 1 from public.categories where slug = 'beauty-fragrance'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'makeup',                'Makeup',                    id, 2 from public.categories where slug = 'beauty-fragrance'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'haircare',              'Haircare',                  id, 3 from public.categories where slug = 'beauty-fragrance'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'fragrance',             'Fragrance',                 id, 4 from public.categories where slug = 'beauty-fragrance'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'personal-care-hygiene', 'Personal Care & Hygiene',   id, 5 from public.categories where slug = 'beauty-fragrance'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'beauty-tools',          'Tools & Accessories',       id, 6 from public.categories where slug = 'beauty-fragrance'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'beauty-supplements',    'Beauty Supplements',        id, 7 from public.categories where slug = 'beauty-fragrance'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Home & Kitchen
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'kitchen-appliances',    'Kitchen Appliances',        id, 1 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'cookware-bakeware',     'Cookware & Bakeware',       id, 2 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'tableware-serveware',   'Tableware & Serveware',     id, 3 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'furniture',             'Furniture',                 id, 4 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'home-decor',            'Home Décor',                id, 5 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'bedding-bath',          'Bedding & Bath',            id, 6 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'lighting',              'Lighting',                  id, 7 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'storage-organization',  'Storage & Organization',    id, 8 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'home-improvement-tools','Home Improvement & Tools',  id, 9 from public.categories where slug = 'home-kitchen'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Grocery
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'pantry-staples',       'Pantry Staples',            id, 1 from public.categories where slug = 'grocery'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'beverages',            'Beverages',                 id, 2 from public.categories where slug = 'grocery'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'breakfast-cereals',    'Breakfast & Cereals',       id, 3 from public.categories where slug = 'grocery'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'snacks-sweets',        'Snacks & Sweets',           id, 4 from public.categories where slug = 'grocery'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'frozen-foods',         'Frozen Foods',              id, 5 from public.categories where slug = 'grocery'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'dairy-bakery',         'Dairy & Bakery',            id, 6 from public.categories where slug = 'grocery'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'household-supplies',   'Household Supplies',        id, 7 from public.categories where slug = 'grocery'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'cleaning-laundry',     'Cleaning & Laundry',        id, 8 from public.categories where slug = 'grocery'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Men's Fashion
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'mens-clothing',        'Men''s Clothing',           id, 1 from public.categories where slug = 'mens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'mens-shoes',           'Men''s Shoes',              id, 2 from public.categories where slug = 'mens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'mens-bags',            'Men''s Bags & Wallets',     id, 3 from public.categories where slug = 'mens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'mens-watches',         'Men''s Watches',            id, 4 from public.categories where slug = 'mens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'mens-accessories',     'Men''s Accessories',        id, 5 from public.categories where slug = 'mens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'mens-traditional',     'Men''s Traditional Wear',   id, 6 from public.categories where slug = 'mens-fashion'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Women's Fashion
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'womens-clothing',      'Women''s Clothing',         id, 1 from public.categories where slug = 'womens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'womens-shoes',         'Women''s Shoes',            id, 2 from public.categories where slug = 'womens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'womens-bags',          'Women''s Bags',             id, 3 from public.categories where slug = 'womens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'womens-jewelry',       'Women''s Jewelry',          id, 4 from public.categories where slug = 'womens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'womens-watches',       'Women''s Watches',          id, 5 from public.categories where slug = 'womens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'womens-accessories',   'Women''s Accessories',      id, 6 from public.categories where slug = 'womens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'womens-traditional',   'Women''s Traditional Wear', id, 7 from public.categories where slug = 'womens-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'lingerie-sleepwear',   'Lingerie & Sleepwear',      id, 8 from public.categories where slug = 'womens-fashion'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Baby
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'diapers-wipes',        'Diapers & Wipes',           id, 1 from public.categories where slug = 'baby'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'feeding-nursing',      'Feeding & Nursing',         id, 2 from public.categories where slug = 'baby'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'baby-care-bath',       'Baby Care & Bath',          id, 3 from public.categories where slug = 'baby'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'strollers-car-seats',  'Strollers & Car Seats',     id, 4 from public.categories where slug = 'baby'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'nursery-furniture',    'Nursery & Furniture',       id, 5 from public.categories where slug = 'baby'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'baby-clothing',        'Baby Clothing',             id, 6 from public.categories where slug = 'baby'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'baby-toys',            'Baby Toys',                 id, 7 from public.categories where slug = 'baby'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Toys
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'action-figures-collectibles', 'Action Figures & Collectibles', id, 1 from public.categories where slug = 'toys'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'dolls-soft-toys',      'Dolls & Soft Toys',         id, 2 from public.categories where slug = 'toys'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'educational-learning', 'Educational & Learning',    id, 3 from public.categories where slug = 'toys'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'building-toys',        'Building Toys',             id, 4 from public.categories where slug = 'toys'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'outdoor-toys',         'Outdoor Toys',              id, 5 from public.categories where slug = 'toys'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'arts-crafts',          'Arts & Crafts',             id, 6 from public.categories where slug = 'toys'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'board-games-puzzles',  'Board Games & Puzzles',     id, 7 from public.categories where slug = 'toys'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'rc-vehicles',          'Remote Control & Vehicles', id, 8 from public.categories where slug = 'toys'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Kids' Fashion
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'boys-clothing',        'Boys'' Clothing',           id, 1 from public.categories where slug = 'kids-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'girls-clothing',       'Girls'' Clothing',          id, 2 from public.categories where slug = 'kids-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'kids-shoes',           'Kids'' Shoes',              id, 3 from public.categories where slug = 'kids-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'kids-accessories',     'Kids'' Accessories',        id, 4 from public.categories where slug = 'kids-fashion'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'school-essentials',    'School Essentials',         id, 5 from public.categories where slug = 'kids-fashion'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Sports & Outdoors
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'fitness-gym',          'Fitness & Gym Equipment',   id, 1 from public.categories where slug = 'sports-outdoors'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'team-sports',          'Team Sports',               id, 2 from public.categories where slug = 'sports-outdoors'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'cycling',              'Cycling',                   id, 3 from public.categories where slug = 'sports-outdoors'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'running-training',     'Running & Training',        id, 4 from public.categories where slug = 'sports-outdoors'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'outdoor-camping',      'Outdoor & Camping',         id, 5 from public.categories where slug = 'sports-outdoors'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'water-sports',         'Water Sports',              id, 6 from public.categories where slug = 'sports-outdoors'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'winter-sports',        'Winter Sports',             id, 7 from public.categories where slug = 'sports-outdoors'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'sportswear-footwear',  'Sportswear & Footwear',     id, 8 from public.categories where slug = 'sports-outdoors'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Health & Nutrition
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'vitamins-supplements', 'Vitamins & Supplements',    id, 1 from public.categories where slug = 'health-nutrition'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'sports-nutrition',     'Sports Nutrition',          id, 2 from public.categories where slug = 'health-nutrition'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'personal-care-medical','Personal Care Medical',     id, 3 from public.categories where slug = 'health-nutrition'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'home-medical',         'Home Medical Equipment',    id, 4 from public.categories where slug = 'health-nutrition'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'sexual-wellness',      'Sexual Wellness',           id, 5 from public.categories where slug = 'health-nutrition'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'weight-management',    'Weight Management',         id, 6 from public.categories where slug = 'health-nutrition'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Stationery & Office
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'writing-instruments',  'Writing Instruments',       id, 1 from public.categories where slug = 'stationery-office'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'notebooks-journals',   'Notebooks & Journals',      id, 2 from public.categories where slug = 'stationery-office'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'office-supplies',      'Office Supplies',           id, 3 from public.categories where slug = 'stationery-office'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'art-supplies',         'Art Supplies',              id, 4 from public.categories where slug = 'stationery-office'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'desk-accessories',     'Desk Accessories',          id, 5 from public.categories where slug = 'stationery-office'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Books & Media
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'books',                'Books',                     id, 1 from public.categories where slug = 'books-media'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'ebooks-audiobooks',    'eBooks & Audiobooks',       id, 2 from public.categories where slug = 'books-media'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'movies-tv',            'Movies & TV',               id, 3 from public.categories where slug = 'books-media'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'music',                'Music',                     id, 4 from public.categories where slug = 'books-media'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'magazines',            'Magazines',                 id, 5 from public.categories where slug = 'books-media'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Automotive
-- ---------------------------------------------------------------------
insert into public.categories (slug, name, parent_id, sort_order)
  select 'car-accessories',      'Car Accessories',           id, 1 from public.categories where slug = 'automotive'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'car-electronics',      'Car Electronics',           id, 2 from public.categories where slug = 'automotive'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'car-care-maintenance', 'Car Care & Maintenance',    id, 3 from public.categories where slug = 'automotive'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'automotive-tools',     'Tools & Equipment',         id, 4 from public.categories where slug = 'automotive'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'motorcycle-accessories','Motorcycle Accessories',   id, 5 from public.categories where slug = 'automotive'
  on conflict (slug) do nothing;
insert into public.categories (slug, name, parent_id, sort_order)
  select 'tires-wheels',         'Tires & Wheels',            id, 6 from public.categories where slug = 'automotive'
  on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Backfill: map 7 legacy text categories → category_id
-- Only touches rows where category_id IS NULL. `category` text is preserved.
-- ---------------------------------------------------------------------
update public.products p set category_id = c.id
  from public.categories c
  where p.category_id is null and p.category = 'Electronics'   and c.slug = 'electronics';

update public.products p set category_id = c.id
  from public.categories c
  where p.category_id is null and p.category = 'Furniture'     and c.slug = 'furniture';

update public.products p set category_id = c.id
  from public.categories c
  where p.category_id is null and p.category = 'Clothing'      and c.slug = 'mens-clothing';

update public.products p set category_id = c.id
  from public.categories c
  where p.category_id is null and p.category = 'Sports'        and c.slug = 'sports-outdoors';

update public.products p set category_id = c.id
  from public.categories c
  where p.category_id is null and p.category = 'Music'         and c.slug = 'music';

update public.products p set category_id = c.id
  from public.categories c
  where p.category_id is null and p.category = 'Photography'   and c.slug = 'cameras-drones';

update public.products p set category_id = c.id
  from public.categories c
  where p.category_id is null and p.category = 'Home & Garden' and c.slug = 'home-kitchen';
