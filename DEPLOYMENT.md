# Deploying the OMS on separate providers

## Configuration

Copy `.env.example` to `apps/api/.env` for local development. In production, use the backend provider's environment settings. The example deliberately contains names with empty values and no provider identifiers or credentials.

| Variable | Where | Required value |
| --- | --- | --- |
| `DATABASE_URL` | Backend | PostgreSQL runtime URL, preferably the provider's pooled endpoint, with TLS as required by the provider |
| `DIRECT_URL` | Migration/build environment | Direct or session-pool PostgreSQL URL capable of running Prisma migrations; do not use a transaction pooler for migrations |
| `JWT_SECRET` | Backend | Random secret of at least 32 characters in production |
| `FRONTEND_URL` | Backend | Exact frontend origin, e.g. `https://oms.example.com`, without a path or trailing slash |
| `NODE_ENV` | Backend | `production` |
| `PORT` | Backend | Provider's injected listening port; defaults to 4000 |
| `VITE_API_URL` | Frontend build | Public backend API base, e.g. `https://api.example.com/api` |

Never put database credentials or JWT secrets in Vite variables. Vite embeds its variables at build time: changing the API address requires rebuilding the frontend. Local development defaults to `http://localhost:4000/api`; production defaults to same-origin `/api` if no value is supplied. Separate providers must set `VITE_API_URL`.

## Build and release

From the repository root:

1. Install with `npm ci` (include development dependencies in the build stage).
2. Set backend database variables and run `npm run db:generate` on the target build OS.
3. Run `npm run build` with `VITE_API_URL` set for the frontend destination.
4. Run `npm run db:deploy` once as a release step against the intended database. Do not run migrations on every startup. Back up existing production data first.
5. Backend: start with `npm run start -w @oms/api`. Deploy a single Node process initially; do not run `npm run dev`. Keep generated Prisma client/engine artifacts and production dependencies in the runtime image.
6. Frontend: publish `apps/web/dist`. Configure the static host to serve `index.html` for application routes, use HTTPS, enable compression, and cache hashed `/assets/*` files for one year with `immutable`. Revalidate `index.html` so releases pick up new asset names. Source maps are not emitted by the current Vite build.
7. Use `/health` (or `/api/health`) for liveness. It performs no database query and does not establish database readiness.

Keep backend and database geographically close. Frontend static assets can use a CDN. Verify login, reports, assignment, order creation and status updates after configuring the deployed origin. Do not run the demo seed on production: it creates accounts with publicly documented passwords. Provision a private administrator through a controlled database/bootstrap process instead.

## Resource and connection limits

The API reuses one Prisma client per process. Missing runtime URL parameters receive conservative defaults: `connection_limit=2`, `pool_timeout=10`, `connect_timeout=10`, `socket_timeout=20`, and `max_idle_connection_lifetime=60` (timeouts in seconds). Explicit URL parameters take precedence. Example shape:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require&connection_limit=2&pool_timeout=10&connect_timeout=10&socket_timeout=20&max_idle_connection_lifetime=60
```

Use the pooler settings supplied by your database provider; add `pgbouncer=true` only when appropriate to that pooler. URL-encode special characters in passwords. These settings target the installed Prisma 6 client; consult the [Prisma 6 PostgreSQL connector reference](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql) before changing them or upgrading Prisma.

Pool limits multiply by running instances. For a serverless adapter, retain the module-scoped client across warm invocations, consider `connection_limit=1`, and cap concurrency to fit the database connection budget. The included entry point is a long-running Express server, not a provider-specific function adapter. Do not disconnect after each request. SIGTERM/SIGINT drain requests and disconnect the pool, with a 10-second shutdown ceiling.

Requests use a 30-second browser timeout. Only GET responses with 502/503/504 receive one delayed retry; writes are never automatically retried. Database availability failures return a clean 503 for supported Prisma error codes. There is no startup database scan or retry loop; subsequent requests reuse the client and can reconnect. A timed-out write may have committed: inspect the order list before submitting it again.

## Review findings and changes

| Area | Finding | Change |
| --- | --- | --- |
| Dashboard | Browser fetched every 100-row page and calculated metrics over all orders | One API request; database groups by status/priority; six recent orders and four attention rows; database workload aggregation |
| Reports | API loaded all matching orders and repeatedly filtered them for each user; UI also downloaded all orders for overdue counts | Parameterized SQL aggregation; 20 users per page, maximum 100; global filtered KPI totals and per-user overdue counts computed in SQL |
| Order list | Full descriptions, attachments and shipment objects returned on every page | Explicit table-field projection; existing 20-row default and 100-row maximum retained |
| Authentication | `/auth/me` queried the same user twice; request authentication fetched password hashes | Reuse the authenticated user projection; permissions still refreshed from the database on every request |
| Connections | Pool size implicitly tied to CPU count; no shutdown cleanup | Two connections by default, finite waits and idle lifetime, graceful shutdown |
| Logging/errors | Every SQL query and full URL logged; unexpected errors dumped wholesale | Remove query/request logging; log sanitized unexpected error type/code; retain generic frontend error envelope; handle malformed/oversized JSON |
| Frontend | All routes eagerly bundled; obsolete list requests remained active | Lazy dashboard/operations chunks; abort obsolete dashboard/report/order-list requests |
| Configuration | Wildcard CORS, fallback production JWT secret, production localhost fallback | Exact environment-controlled origin; required startup values validated; production API defaults to `/api` |
| Files | URL metadata API accepted non-HTTP URL schemes | HTTP(S) URLs only, maximum 2,048 characters; existing Express 100 kB JSON body limit retained |

Search is explicitly submitted with Apply, so typing causes no API calls; adding debounce would change that interaction unnecessarily. Existing create-order and login buttons already disable while saving. Order numbers have a database unique constraint and UUID generation. No new runtime dependencies were added, removed or replaced: the existing libraries are in use. No workers, cron loops, polling, binary uploads, Redis, or other services were found or introduced. No order/auth caches were added, avoiding stale status and permission behavior.

## Indexes

Migration `20261005000300_performance` adds:

- `Order(createdAt, serialNumber)` for creation/age ordering and date ranges.
- `Order(updatedAt, serialNumber)` for recent dashboard activity.
- `Order(status, createdAt)` for status/date filtering.
- `FileRecord(orderId)` for detail retrieval and cascading deletion.

Existing primary/unique indexes already cover order IDs, order numbers, serial numbers and user emails. Assignment user lookup and `(orderId, createdAt)` history indexes already exist. Do not add isolated indexes on every priority/phone/type field without evidence. The current search uses case-insensitive substring matching; ordinary B-tree indexes will not solve that. Consider PostgreSQL trigram indexes only after inspecting representative query plans and accepting their storage/write cost. New indexes use ordinary CREATE INDEX; schedule the release during low activity for an established database.

## Verification and remaining limits

Production build passed. Initial JS changed from 277.20 kB (90.56 kB gzip) to 260.85 kB (87.03 kB gzip), with separate dashboard and operations chunks. This is code splitting, not a claim that total downloaded code always decreases. No synthetic CPU/RAM or remote-provider latency numbers are claimed.

Eight backend unit tests pass and cover workflows, aging, filters, sorting and configuration. Disposable PostgreSQL integration tests cover permissions, immediate role refresh, assignment, report aggregation/pagination, out-of-range pages, global summary totals, dashboard scoping, compact list responses and URL validation. There are no frontend unit tests or lint scripts in this repository.

Remaining free-tier risks:

- Provider sleep and database wake-up can exceed request timeouts. Hosting resources and quotas must be measured on the actual deployment.
- Reports and dashboard aggregates still scan matching records in the database; filters reduce that cost. Reports support dates but preserve the existing all-time default.
- Deep offset pagination and substring searches can slow down with large datasets. No speculative full-text search subsystem was introduced.
- User selectors/admin user lists, dashboard assignee rows, and a single order's attachment/history lists are still unpaginated. These are suitable for the current small-team UI, but should be paginated if those collections grow substantially.
- Attachment handling only registers URLs, and cannot enforce remote file byte size or dimensions. Before implementing actual uploads, enforce type/size/dimension limits in an object-storage upload flow and use thumbnails. The API neither downloads nor stores image bytes.
- Multiple manually repeated POSTs can create separate orders even though each order number is unique; there is no persistent idempotency-key protocol. Never automatically replay a timed-out write.
- Login uses bcrypt and currently has no rate limiter; use host-level request limits for a publicly reachable deployment.
- A dashboard is assembled from concurrent queries, not a transaction snapshot; concurrent updates can briefly affect metric consistency.

Re-run `npm test` and `npm run build` before release. For integration checks, use a disposable migrated database and run `OMS_TEST_DATABASE=1 node apps/api/scripts/verify-integration.cjs` with explicit `DATABASE_URL` and `DIRECT_URL`. This script creates fixtures and changes aging settings; it must not target production.
