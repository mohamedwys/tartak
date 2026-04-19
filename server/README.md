# Qwiksell API — Supabase edition

Express API powering the Qwiksell Angular frontend, backed by **Supabase
(Postgres + Storage)**. Replaces the previous MongoDB/Mongoose stack.

## Stack

- Node 20+ / Express 4 (ES modules)
- `@supabase/supabase-js` (service-role client, bypasses RLS)
- `bcryptjs` + `jsonwebtoken` for auth (JWT compatible with the existing frontend)
- `multer` → Supabase Storage for image uploads
- `zod` for request validation

## Quick start

```bash
# 1. Install deps
cd server
npm install

# 2. Configure env
cp .env.example .env
#   Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET

# 3. Apply DB schema (one of):
#    a) Supabase CLI:  supabase db push
#    b) Paste files in supabase/migrations/*.sql into the SQL editor

# 4. Create the storage bucket (one-time):
#    Supabase Dashboard → Storage → New Bucket
#      Name:   product-images   (match SUPABASE_STORAGE_BUCKET)
#      Public: yes

# 5. Run
npm run dev   # or: npm start
```

Then point the frontend at it by editing `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
};
```

## Endpoint reference

Base URL: `/api`

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET    | `/health` | — | liveness |
| POST   | `/user/register` | — | `{ name, email, password }` → `{ token, user }` |
| POST   | `/user/login` | — | `{ email, password }` → `{ token, user }` |
| PUT    | `/user/profile` | ✅ | `{ name, avatarUrl? }` |
| GET    | `/user/verify?token=…` | — | email verification |
| POST   | `/user/forgot-password` | — | `{ email }` |
| POST   | `/user/reset-password/:token` | — | `{ password }` |
| GET    | `/user/:id/profile` | — | public seller profile + rating stats |
| GET    | `/products` | — | filters: `page,limit,sort,q,category,condition,minPrice,maxPrice,ownerId` |
| GET    | `/products/:id` | — | populates `ownerId` |
| GET    | `/products/:id/similar` | — | same-category items |
| POST   | `/products` | ✅ | create listing |
| PUT    | `/products/:id` | ✅ owner | update listing |
| DELETE | `/products/:id` | ✅ owner | delete listing |
| PATCH  | `/products/:id/sold` | ✅ owner | mark sold |
| POST   | `/favorites/:productId` | ✅ | toggle → `{ favorited }` |
| GET    | `/favorites/ids` | ✅ | `string[]` of product ids |
| GET    | `/favorites` | ✅ | full product list |
| POST   | `/messages` | ✅ | send text message |
| GET    | `/messages/inbox` | ✅ | aggregated threads |
| GET    | `/messages/conversation/:userId/:productId` | ✅ | thread messages (with `offerRef` populated) |
| PATCH  | `/messages/conversation/:userId/:productId/read` | ✅ | mark unread messages read |
| POST   | `/offers` | ✅ | also posts a `type:"offer"` message |
| GET    | `/offers/mine` | ✅ | offers I made |
| GET    | `/offers/product/:productId` | ✅ seller | offers on my listing |
| PATCH  | `/offers/:offerId` | ✅ seller | `{ status: 'accepted' \| 'declined' }` |
| POST   | `/ratings` | ✅ | `{ sellerId, stars, comment? }` (upsert) |
| GET    | `/ratings/seller/:sellerId` | — | populates `reviewerId` |
| POST   | `/reports` | ✅ | `{ productId, reason }` (409 if dup) |
| POST   | `/orders` | ✅ | buyer creates order |
| GET    | `/orders` | ✅ | my order history |
| POST   | `/upload` | ✅ | multipart `image` → `{ url }` |

## Auth model

Custom JWTs signed by this backend with the frontend-expected claim shape:

```json
{ "id": "<uuid>", "email": "a@b.co", "iat": …, "exp": … }
```

The frontend base64-decodes the token body to read `id`; preserving that
claim is why we don't use Supabase Auth directly (its JWTs use `sub`).
Supabase is used purely as the database/storage layer.

If you later migrate to Supabase Auth, the JWT middleware in
`src/middleware/auth.js` is the only swap point.

## Security

- Backend uses the **service-role key**. RLS policies in
  `supabase/migrations/20260419000001_rls_policies.sql` are a
  defense-in-depth layer in case the anon key ever leaks or clients
  later talk to Supabase directly.
- Password hashes: bcrypt w/ cost 12.
- Image uploads: 5 MB limit, mime-type checked.
- Email-existence enumeration blocked on `/forgot-password` (always 200).

## Data migration from MongoDB

`scripts/migrate-mongo-to-supabase.js` copies existing Mongo data into
Supabase. It derives stable UUIDs from Mongo ObjectIds (UUIDv5) so reruns
are idempotent. Set `MONGO_URI` and `MONGO_DB_NAME` in `.env` and run:

```bash
node ../scripts/migrate-mongo-to-supabase.js
```

## Project layout

```
server/
  src/
    index.js              Express bootstrap
    config/env.js         env loader (required-var check)
    config/supabase.js    service-role client
    middleware/auth.js    requireAuth / optionalAuth
    middleware/error.js   404 + error handler (Zod-aware)
    utils/jwt.js          auth + scoped token helpers
    utils/mapping.js      DB row → API response mappers (_id, populated relations)
    utils/async.js        asyncHandler + HttpError
    routes/
      auth.routes.js
      users.routes.js
      products.routes.js
      favorites.routes.js
      messages.routes.js
      offers.routes.js
      ratings.routes.js
      reports.routes.js
      orders.routes.js
      upload.routes.js
supabase/
  migrations/
    20260419000000_initial_schema.sql
    20260419000001_rls_policies.sql
scripts/
  migrate-mongo-to-supabase.js
```
