# Future Cloudflare Migration

Status: keep this file untracked. Do not commit it until the migration approach is fully confirmed.

## Why this repo needs a careful migration

- This storefront is a more serious runtime candidate than the admin app.
- It has order-related API routes and crypto/rate-limit helpers.
- It is still a realistic Cloudflare target, but it should be hardened first.

## Migration goal

Move `thesmokehouse` to Cloudflare as a paid Workers/OpenNext deployment without creating fragile order flows.

## Main risks to handle first

1. Crypto helpers in `lib/order-utils.ts` and `lib/rate-limit.ts`.
2. Request-path work in the orders API routes.
3. Forced dynamic rendering on key pages.
4. Any hidden assumptions around env vars and Supabase clients.

## Implementation plan

### Phase 1: Harden the hot paths

1. Review order creation and order-read endpoints.
   - Open `app/api/orders/route.ts`.
   - Open `app/api/orders/[public_token]/route.ts`.
   - For each route, list every step that happens before the response is returned.
   - Remove any non-essential work from the request path.

2. Refactor crypto helpers.
   - Review `lib/order-utils.ts`.
   - Review `lib/rate-limit.ts`.
   - Prefer Web Crypto-friendly APIs where possible.
   - Avoid adding any new Node-only crypto imports.

3. Add request-size and validation guards.
   - Ensure write endpoints reject oversized bodies early.
   - Ensure validation happens once, not repeatedly.

4. Keep side effects out of the response path.
   - If there are any notifications, analytics fan-out, or non-critical writes, move them behind the main response path when practical.

### Phase 2: Reduce unnecessary dynamic work

1. Audit dynamic rendering.
   - Check routes using `dynamic = "force-dynamic"`.
   - Remove forced dynamic rendering where data can be cached safely.
   - Keep dynamic rendering only where business logic requires it.

2. Audit `next/image` usage.
   - Confirm whether images should stay on-demand or move to pre-generated variants later.
   - If image cost becomes a concern, separate that work from the runtime migration.

### Phase 3: Add Cloudflare deployment scaffolding

1. Install the OpenNext Cloudflare adapter and `wrangler`.
2. Add Cloudflare config files with comments.
3. Add scripts for local preview and deploy.
4. Document required env vars and secrets.

### Phase 4: Validate in preview

1. Test the homepage and menu pages.
2. Test order creation from the storefront.
3. Test order lookup by public token.
4. Confirm image behavior is correct.
5. Confirm no hidden Node-specific runtime crash appears in preview logs.

### Phase 5: Rollout plan

1. Keep Vercel available as rollback.
2. Test Cloudflare preview with real but low-risk traffic.
3. Cut over only after order creation is stable.

## What to leave alone for now

- Current UI design and layout.
- Existing order schema.
- Existing public token flow unless migration testing exposes a problem.

## Definition of done

- Home and menu pages load correctly.
- Order creation works.
- Order lookup works.
- Logs show no runtime compatibility failures.
- Rollback path is preserved.
