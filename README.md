# Tartak / Qwiksell

Monorepo for the Qwiksell marketplace.

```
.
├── src/                        Angular 18 frontend
├── server/                     Express API (Supabase-backed)
├── supabase/migrations/        SQL schema + RLS policies
└── scripts/                    One-off migration tooling (Mongo → Supabase)
```

## Architecture

The backend is a thin Express API that uses **Supabase** (Postgres + Storage)
as the database layer. MongoDB/Mongoose is **no longer used** anywhere;
previously the `mongoose`, `bcryptjs`, and `jsonwebtoken` packages were
listed as frontend dependencies but never imported — they've been removed
and relocated to the backend where they belong.

Frontend ⇄ `/api` Express ⇄ Supabase Postgres / Storage.

## Getting started

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # fill in SUPABASE_URL, SERVICE_ROLE_KEY, JWT_SECRET
```

Apply the schema via either the Supabase CLI (`supabase db push`) or by
pasting `supabase/migrations/*.sql` into the SQL editor.

Create a public Storage bucket named `product-images` (or whatever you
set `SUPABASE_STORAGE_BUCKET` to).

```bash
npm run dev   # http://localhost:5000
```

See `server/README.md` for the full endpoint reference.

### 2. Frontend (Angular 18)

```bash
npm install
npm start     # http://localhost:4200
```

`src/environments/environment.ts` already points at `http://localhost:5000/api`.

## Migrating existing MongoDB data

If you have Mongo data to port, set `MONGO_URI` + `MONGO_DB_NAME` in
`server/.env` and run:

```bash
cd server
node ../scripts/migrate-mongo-to-supabase.js
```

The script maps ObjectIds → deterministic UUIDv5 and upserts in batches,
so re-runs are idempotent.

## What changed vs. the MongoDB version

| Before (MongoDB)            | After (Supabase)                                     |
| --------------------------- | ---------------------------------------------------- |
| `ObjectId`                  | `uuid` PK (UUIDv5 when migrated)                     |
| `mongoose.Schema`           | SQL tables (`supabase/migrations/*.sql`)             |
| `Model.find(...)`           | `supabase.from('...').select(...)`                   |
| `Model.aggregate(...)`      | SQL joins / `select` with FK embeds                  |
| Mongo connection string     | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`         |
| Ad-hoc image storage        | Supabase Storage (public bucket) via `multer`        |
| No access control           | RLS policies on every table (defense in depth)       |

## Risks & assumptions

- **Auth**: The frontend decodes JWT payloads directly and reads an `id`
  claim. Supabase Auth's native JWTs use `sub`, so this backend keeps
  custom-signed JWTs (with bcrypt-hashed passwords in `public.users`).
  Swapping to native Supabase Auth later requires a token-migration pass
  and an updated frontend JWT parser.
- **Uploads**: `/api/upload` now returns **absolute** Supabase Storage
  URLs. `src/app/services/upload.service.ts` was updated to pass through
  absolute URLs unchanged (relative paths still get the API base prefixed
  for backwards compat).
- **Seller ratings aggregate** is computed at read time in
  `GET /api/user/:id/profile`. If rating volume grows, add a
  materialized view or `ratings_stats` cache table.
- **Inbox aggregation** fetches up to 500 most-recent messages involving
  the user. Scale bottleneck once threads grow — upgrade to a dedicated
  `threads` table or a Postgres view.
- **Mongo migration script** assumes typical collection names (`users`,
  `products`, `offers`, …) and field names (`ownerId`, `senderId`, etc).
  Adjust the `COLLECTIONS` map and field-read fallbacks if your original
  schema differs.

## Endpoints kept / removed

All 30+ endpoints the Angular frontend calls are preserved exactly. No
frontend route or payload change was required except for the
`UploadService` URL-handling tweak noted above.
