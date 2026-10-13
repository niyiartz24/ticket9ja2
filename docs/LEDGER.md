# Ticket9ja implementation ledger
## Phase 1 - Foundation: scaffolded, NOT yet verified (run: npm run typecheck && npm test && npm run build)
Done: Next.js/TS/Tailwind/shadcn, env validation, integer money utils, security headers, Vitest, homepage shell.
Pending: Phase 2 (Prisma schema + auth). /events route does not exist yet.
External still required: Postgres URL, Resend key, payment provider credentials.

## Phase 2 - Database and auth: scaffolded, NOT yet verified
Done: full Prisma schema (users, sessions, invitations, events, ticket types with sold/reserved counters,
orders, items, tickets with unique (orderItem, sequence), payments, payment events keyed for webhook
idempotency, scans, audit log, email outbox with dedupeKey), DB-backed sessions with hashed tokens,
argon2 passwords, requireRole guards, login/logout, guarded /admin and /organizer, env-based Super Admin seed.
To verify: npx prisma migrate dev --name init && npm run db:seed && npm test && npm run typecheck
Pending: login rate limiting, password reset and email verification flows (tables exist), middleware cookie check.

## Phase 3 - Super Admin and invitations: scaffolded, NOT yet verified
Done: email provider abstraction (Resend over fetch, console fallback in dev only), hashed single-use 7-day
invitation tokens, create/resend(rotates token)/revoke, transactional atomic accept, DB partial unique index
(one pending invite per email), admin layout, /admin/invitations, /admin/organizers (suspend kills sessions),
/invite/[token] accept page, audit logging on every step.
To verify:
  npx prisma migrate dev            # applies the partial-index migration
  npm test                          # unit tests
  TEST_DATABASE_URL=<throwaway db, migrated with prisma migrate deploy> npm test   # integration tests
Pending: login/accept rate limiting, admin overview stats (Phase 10), real email delivery check with Resend key.
Note: the integration test cleanup wipes AuditLog - run it only against a throwaway database.

## Phase 4 - Organizer dashboard and events: scaffolded, NOT yet verified
Done: organizer layout + overview (real counts), event list/create/edit, draft save, publish/unpublish/cancel,
timezone-correct date handling (wall time in event tz <-> UTC), immutable slugs with collision retry,
publish readiness rules (description, venue or https link, future end, >=1 active ticket type),
published events stay complete on edit, cancel keeps all records, every service function scoped by organizerId
(foreign ids behave as "not found"), cover upload with magic-byte sniffing and 2 MB cap.
To verify: npm test; TEST_DATABASE_URL=<throwaway migrated db> npm test; npm run typecheck; manual create/publish flow.
Known limitations:
- Publishing needs a ticket type, and the ticket type UI arrives in Phase 5, so publish cannot succeed in the UI until then.
- Cover storage is a local-disk driver (dev only). Production needs an object-storage driver in src/lib/storage.ts.
- COMPLETED status is not yet assigned automatically (to be done with the scheduled job in Phase 8/10).
- Rate limiting still pending. No RHF used: forms are server-validated native forms.

## Phase 5 - Ticket types and inventory: scaffolded, NOT yet verified
Done: ticket type create/edit/activate/deactivate/delete (ownership-scoped, string-parsed prices in kobo),
sales windows (event and ticket windows both apply), per-order min/max, createReservedOrder (server-side pricing,
atomic conditional UPDATE so reserved+sold never exceeds total, all-or-nothing across lines, stable lock order),
confirmOrderSale and releaseOrder (idempotent, tx-composable), stale reservation expiry (15 min) that self-heals on
the next checkout and via /api/cron/expire-reservations (Bearer CRON_SECRET), quantity cannot drop below committed stock.
To verify: npm run typecheck; npm test; TEST_DATABASE_URL=<throwaway migrated db> npm test
(key tests: 25 concurrent buyers for 5 tickets, multi-line rollback, double confirm, expiry self-heal).
Known limitations / decisions for Phase 7:
- A payment that succeeds after its order expired needs a policy (re-reserve if stock remains, else refund). Not implemented yet.
- Free orders are created PENDING and must be finalized with confirmOrderSale by the checkout flow (Phase 6).
- Cron: Vercel Hobby only allows daily crons; use Render cron or an external pinger every ~5 min. Not required for correctness.
- Currency is NGN only for now.

## Phase 6 - Public website and checkout: scaffolded, NOT yet verified
Done: (public) layout, homepage with live upcoming events, /events discovery (search, date, price, format filters,
pagination, URL-driven, input whitelisted), event detail page (SEO metadata, cancelled/ended states, per-type
availability messages), ticket picker with name/email, server action checkout (prices and availability never taken
from the client), free checkout finalized atomically (confirm sale + issue tickets in one transaction),
paid checkout creates a PENDING reserved order, order page with masked email, order lookup (reference + email),
idempotent ticket issuance core (unique code + opaque QR token, only for PAID orders),
DB-backed rate limiting (new migration) applied to checkout, order lookup, login and invitation accept.
To verify: npx prisma migrate dev; npm run typecheck; npm test; TEST_DATABASE_URL=<throwaway migrated db> npm test.
Known limitations:
- Paid orders cannot be paid yet (Phase 7). Pending paid orders just expire after 15 minutes.
- Free tickets are issued but NOT emailed and have no QR image or ticket page yet (Phase 8).
  Phase 8 must backfill emails for any PAID order issued before email existed.
- Rate limiter keys on the first X-Forwarded-For entry; confirm your host sets it correctly. Old buckets are not yet pruned.
- A determined attacker with many IPs could still hold stock via pending paid orders for 15 minutes each; per-email caps are future work.
