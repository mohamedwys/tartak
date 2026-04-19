/**
 * Mongo → Supabase data migration.
 *
 * This script is provided as a template for teams that already have
 * MongoDB data and want to port it to the new Supabase schema. It is
 * idempotent — it maps Mongo ObjectIds to deterministic UUIDv5 values so
 * repeated runs won't duplicate rows.
 *
 * Required env vars (put them in server/.env):
 *   MONGO_URI=mongodb+srv://...
 *   MONGO_DB_NAME=your-db
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Expected Mongo collection names (adjust `COLLECTIONS` below if yours differ):
 *   users, products, favorites, messages, offers, ratings, reports, orders
 *
 * Run:
 *   cd server && npm install
 *   node ../scripts/migrate-mongo-to-supabase.js
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';

const MONGO_URI     = process.env.MONGO_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const SB_URL        = process.env.SUPABASE_URL;
const SB_KEY        = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MONGO_URI || !MONGO_DB_NAME) {
  console.error('Set MONGO_URI and MONGO_DB_NAME in server/.env before running.');
  process.exit(1);
}
if (!SB_URL || !SB_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env before running.');
  process.exit(1);
}

const COLLECTIONS = {
  users: 'users',
  products: 'products',
  favorites: 'favorites',
  messages: 'messages',
  offers: 'offers',
  ratings: 'ratings',
  reports: 'reports',
  orders: 'orders',
};

// Deterministic ObjectId → UUIDv5 so repeated runs produce identical UUIDs.
const NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // uuidv5 DNS namespace
function oidToUuid(oid) {
  if (!oid) return null;
  const input = oid instanceof ObjectId ? oid.toHexString() : String(oid);
  const nsBuf  = Buffer.from(NS.replace(/-/g, ''), 'hex');
  const hash   = crypto.createHash('sha1').update(nsBuf).update(input).digest();
  const bytes  = hash.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

async function upsertInBatches(supabase, table, rows, onConflict = 'id', size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(`Failed upsert into ${table}:`, error);
      throw error;
    }
    console.log(`  ↳ ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}

async function main() {
  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const db = mongo.db(MONGO_DB_NAME);
  const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

  // ----- users -----
  console.log('Migrating users…');
  const users = await db.collection(COLLECTIONS.users).find({}).toArray();
  await upsertInBatches(supabase, 'users', users.map(u => ({
    id:                     oidToUuid(u._id),
    email:                  String(u.email).toLowerCase(),
    password_hash:          u.password ?? u.passwordHash ?? '',
    name:                   u.name ?? 'User',
    avatar_url:             u.avatarUrl ?? null,
    email_verified:         !!u.emailVerified,
    verification_token:     u.verificationToken ?? null,
    password_reset_token:   u.passwordResetToken ?? null,
    password_reset_expires: u.passwordResetExpires ?? null,
    created_at:             u.createdAt ?? new Date(),
    updated_at:             u.updatedAt ?? new Date(),
  })));

  // ----- products -----
  console.log('Migrating products…');
  const products = await db.collection(COLLECTIONS.products).find({}).toArray();
  await upsertInBatches(supabase, 'products', products.map(p => ({
    id:          oidToUuid(p._id),
    owner_id:    oidToUuid(p.ownerId ?? p.owner ?? p.userId),
    name:        p.name,
    description: p.description ?? '',
    price:       Number(p.price ?? 0),
    category:    p.category ?? 'Other',
    condition:   p.condition ?? null,
    image_url:   p.imageUrl ?? '',
    image_urls:  Array.isArray(p.imageUrls) ? p.imageUrls : [],
    sold:        !!p.sold,
    created_at:  p.createdAt ?? new Date(),
    updated_at:  p.updatedAt ?? new Date(),
  })));

  // ----- favorites -----
  console.log('Migrating favorites…');
  const favs = await db.collection(COLLECTIONS.favorites).find({}).toArray();
  await upsertInBatches(supabase, 'favorites', favs.map(f => ({
    user_id:    oidToUuid(f.userId ?? f.user),
    product_id: oidToUuid(f.productId ?? f.product),
    created_at: f.createdAt ?? new Date(),
  })), 'user_id,product_id');

  // ----- offers -----
  console.log('Migrating offers…');
  const offers = await db.collection(COLLECTIONS.offers).find({}).toArray();
  await upsertInBatches(supabase, 'offers', offers.map(o => ({
    id:         oidToUuid(o._id),
    product_id: oidToUuid(o.productId ?? o.product),
    buyer_id:   oidToUuid(o.buyerId  ?? o.buyer),
    seller_id:  oidToUuid(o.sellerId ?? o.seller),
    amount:     Number(o.amount ?? 0),
    message:    o.message ?? null,
    status:     o.status ?? 'pending',
    created_at: o.createdAt ?? new Date(),
    updated_at: o.updatedAt ?? new Date(),
  })));

  // ----- messages -----
  console.log('Migrating messages…');
  const msgs = await db.collection(COLLECTIONS.messages).find({}).toArray();
  await upsertInBatches(supabase, 'messages', msgs.map(m => ({
    id:           oidToUuid(m._id),
    sender_id:    oidToUuid(m.senderId    ?? m.sender),
    recipient_id: oidToUuid(m.recipientId ?? m.recipient),
    product_id:   oidToUuid(m.productId   ?? m.product),
    content:      m.content ?? '',
    type:         m.type === 'offer' ? 'offer' : 'text',
    offer_id:     m.offerRef ? oidToUuid(m.offerRef) : null,
    read_at:      m.readAt ?? null,
    created_at:   m.createdAt ?? new Date(),
  })));

  // ----- ratings -----
  console.log('Migrating ratings…');
  const ratings = await db.collection(COLLECTIONS.ratings).find({}).toArray();
  await upsertInBatches(supabase, 'ratings', ratings.map(r => ({
    id:          oidToUuid(r._id),
    seller_id:   oidToUuid(r.sellerId   ?? r.seller),
    reviewer_id: oidToUuid(r.reviewerId ?? r.reviewer),
    stars:       Number(r.stars ?? 5),
    comment:     r.comment ?? null,
    created_at:  r.createdAt ?? new Date(),
  })));

  // ----- reports -----
  console.log('Migrating reports…');
  const reports = await db.collection(COLLECTIONS.reports).find({}).toArray();
  await upsertInBatches(supabase, 'reports', reports.map(r => ({
    id:          oidToUuid(r._id),
    product_id:  oidToUuid(r.productId  ?? r.product),
    reporter_id: oidToUuid(r.reporterId ?? r.reporter),
    reason:      r.reason ?? 'other',
    created_at:  r.createdAt ?? new Date(),
  })));

  // ----- orders -----
  console.log('Migrating orders…');
  const orders = await db.collection(COLLECTIONS.orders).find({}).toArray();
  await upsertInBatches(supabase, 'orders', orders.map(o => ({
    id:               oidToUuid(o._id),
    buyer_id:         oidToUuid(o.buyerId ?? o.buyer ?? o.userId),
    items:            Array.isArray(o.items) ? o.items.map(it => ({
                        productId: typeof it.productId === 'string'
                          ? oidToUuid(it.productId) : oidToUuid(it.productId?._id ?? it.productId),
                        name:      it.name,
                        price:     Number(it.price ?? 0),
                        quantity:  Number(it.quantity ?? 1),
                        imageUrl:  it.imageUrl ?? null,
                      })) : [],
    total:            Number(o.total ?? 0),
    shipping_address: o.shippingAddress ?? {},
    status:           o.status ?? 'pending',
    created_at:       o.createdAt ?? new Date(),
  })));

  await mongo.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
