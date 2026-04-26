# Firestone Country Smokehouse Storefront

Customer-facing takeaway storefront for Firestone Country Smokehouse, built with Next.js App Router, TypeScript, TailwindCSS, Supabase PostgreSQL, Zustand cart state, Pesapal payments, and PWA support.

## Stack

- Next.js App Router
- TypeScript
- TailwindCSS
- Supabase PostgreSQL
- Next.js Route Handlers
- Zustand cart state
- Pesapal payment initiation, callback, IPN, and status verification
- PWA manifest, install icons, offline page, and service worker caching

## Current Flow

- Customers browse stock-aware menu items from shared Smokehouse admin data.
- Sides and drinks render as add-ons under protein cards, but still submit as normal order items.
- Checkout creates a pending `orders` row and immediately starts Pesapal payment.
- Stock is not reserved while payment is pending.
- Verified Pesapal payment marks the order `paid`, moves it into the `confirmed` kitchen queue, and reserves service-day stock.
- Staff progress paid orders through `confirmed -> in_prep -> ready -> completed` in the admin app.
- Pickup completion is gated by the customer's pickup code.

## Routes

- `/` menu with add-on selection and desktop cart
- `/cart`
- `/checkout`
- `/payment/result`
- `/order/[public_token]`
- `/offline`

## API

- `GET /api/menu`
- `POST /api/orders`
- `GET /api/orders/[public_token]`
- `GET /api/payments/pesapal/callback`
- `GET /api/payments/pesapal/ipn`
- `POST /api/payments/pesapal/ipn`
- `GET /api/payments/pesapal/status`

## Environment Variables

Create `.env.local` with the Supabase, site URL, and Pesapal values used by the storefront server routes:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_SECRET_KEY=optional_service_role_alias
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SITE_URL=http://localhost:3000
PESAPAL_BASE_URL=https://cybqa.pesapal.com/pesapalv3
PESAPAL_CONSUMER_KEY=your_pesapal_consumer_key
PESAPAL_CONSUMER_SECRET=your_pesapal_consumer_secret
PESAPAL_FORCE_INIT_REJECTION=false
```

`SUPABASE_SERVICE_ROLE_KEY` is preferred. `SUPABASE_SECRET_KEY` is accepted as a fallback for local compatibility.

## Database Setup

This storefront now uses the shared Smokehouse operational schema owned by the admin repo. The current project database has already had the storefront/order/payment phases applied; keep this list as the baseline required for any fresh Supabase environment:

- `db/phase-10-storefront-shared-order-support.sql`
- `db/phase-19-order-lifecycle-simplification.sql`
- `db/phase-21-pesapal-paid-reservations.sql`
- `db/phase-22-admin-rls-lockdown.sql`
- `db/phase-23-orders-realtime-publication.sql`

The historical standalone schema in `supabase/schema.sql` is kept only as an archive of the first storefront prototype and should not be applied to a current Smokehouse database.

## Security Model

- Browser code never writes directly to Supabase.
- The service-role key is read only by server-side route handlers.
- Order totals are recomputed server-side from database prices.
- Public order tracking uses `public_token`, not sequential database IDs.
- Stock reservation is owned by database functions after payment verification.
- Basic in-memory rate limiting protects order creation by IP and phone hash.

## PWA

- Manifest: `public/manifest.webmanifest`
- Service worker: `public/sw.js`
- Registration component: `components/pwa-register.tsx`
- Icons: `public/icons/logo-square.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`

The service worker caches the shell, selected static navigation routes, runtime assets, and images. Checkout, payment, API, and order-tracking pages remain network-first/dynamic.

## Run Locally

```bash
npm install
npm run dev
```

Optional seed menu:

```bash
npm run seed
```

## Deploy To Vercel

1. Push repo to Git provider.
2. Import the project in Vercel.
3. Set the Supabase, site URL, and Pesapal environment variables.
4. Confirm the target Supabase project has the shared admin schema baseline listed above.
5. Deploy and run a Pesapal sandbox checkout from order creation through admin pickup-code completion.

## Launch Notes

- Push notifications are not implemented yet.
- Payment result pages exist but still need stronger Smokehouse branding and clearer recovery paths.
- Run end-to-end payment tests for paid, pending, failed, cancelled, abandoned, delayed IPN, and duplicate callback/IPN cases before final launch.
