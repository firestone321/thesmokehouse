# Firestone Country Smokehouse PWA

Production-ready guest checkout smokehouse takeaway app built with Next.js App Router, TypeScript, TailwindCSS, Supabase PostgreSQL, and secure server-only writes.

## Stack
- Next.js (App Router)
- TypeScript
- TailwindCSS
- Supabase PostgreSQL
- Next.js Route Handlers (server API)
- Zustand (cart state)
- PWA (manifest + service worker)

## Security Model
- Browser never writes directly to Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in server code.
- All writes happen through `app/api/*` route handlers.
- Order totals are computed server-side from DB prices.
- Public customer tracking uses `public_token` only (not sequential IDs).
- Admin status updates require `x-admin-password` matching `ADMIN_PASSWORD`.
- Basic in-memory rate limiting by IP and hashed phone for spam mitigation.

## Routes
- `/` menu + mobile sticky cart + desktop cart section
- `/cart`
- `/checkout`
- `/order/[public_token]`
- `/admin`

## API
- `GET /api/menu`
- `POST /api/orders`
- `GET /api/orders/[public_token]`
- `GET /api/admin/orders` (admin password required)
- `PATCH /api/admin/orders/[id]` (admin password required)

## Environment Variables
Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=your_admin_password
```

## Database Setup
Run this SQL in Supabase SQL editor:

```sql
create extension if not exists pgcrypto;

create sequence if not exists order_number_seq start 1001;

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (category in ('roasted_meat', 'sides', 'drinks')),
  price integer not null check (price > 0),
  image_url text,
  is_available boolean default true,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('order_number_seq'),
  public_token text unique not null,
  pickup_code text not null check (pickup_code ~ '^[0-9]{4}$'),
  name text not null,
  phone text not null,
  notes text,
  status text not null check (status in ('received', 'preparing', 'ready', 'picked_up')),
  pickup_time text not null,
  total_amount integer not null check (total_amount > 0),
  created_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  quantity integer not null check (quantity > 0),
  price_at_time integer not null check (price_at_time > 0)
);

create index if not exists idx_orders_public_token on orders(public_token);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_order_items_order_id on order_items(order_id);
```

Schema file is also at `supabase/schema.sql`.

## RLS Guidance (Defense in Depth)
Even with server-only service-role usage, enable RLS and least-privilege policies:
- Keep service role key only on server.
- Enable RLS on all tables.
- Add explicit policies only for required read/write actors.
- If anon direct menu reads are needed later, add read-only policy for available menu items.

## Run Locally
```bash
npm install
npm run dev
```

Optional seed menu:
```bash
npm run seed
```

## PWA
- Manifest: `public/manifest.json`
- Service worker: `public/sw.js`
- Registration: `public/sw-register.js`
- Icons: `public/icons/icon-192.png`, `public/icons/icon-512.png`

Caching includes app shell, `/api/menu`, and images.

## Deploy to Vercel
1. Push repo to Git provider.
2. Import project in Vercel.
3. Set env vars in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
4. Deploy.
5. Run `supabase/schema.sql` in production DB.
6. Optionally run `npm run seed` from local with production env vars.

## Notes
- In-memory rate limiting resets between server restarts/instances. For multi-instance production hardening, swap to Redis-based limiter.
- Placeholder app icons are included; replace with branded 192x192 and 512x512 PNGs.
