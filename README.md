# Order Management System (OMS)

An internal application for manually managed orders. It follows the required lifecycle:

`ORDER_RECEIVED → DESIGNING → CUTTING_AND_PRINTING → MAKING → PACKING_AND_DISPATCH → COMPLETED`

## Architecture

| Layer | Choice | Responsibility |
| --- | --- | --- |
| Web | React, TypeScript, Tailwind, React Router, Axios | Dashboard and role-aware order operations |
| API | Express, TypeScript, Prisma | REST API, validation, auth/RBAC and workflow rules |
| Data | PostgreSQL | Orders, assignments, status history, files and shipments |

The API is intentionally synchronous and simple: no WebSockets, message brokers, Redis Pub/Sub, IoT/machine integrations, or Kubernetes are used.

## Delivery phases

1. **Foundation (included):** schema, JWT authentication/RBAC, orders, status history, assignments, files, shipments, dashboard and seed data.
2. **Operations UI (included):** login, dashboard, order list/filter/search, create order, and order detail workflow controls.
3. **Later extension points:** a real object-store upload adapter, audit export and notifications. The `FileRecord` API is an abstraction; it currently accepts metadata/URLs rather than binary uploads.

## Run locally

Prerequisites: Node 20+, npm 10+, PostgreSQL 15+.

1. Copy `.env.example` to `apps/api/.env`, replace `[YOUR-PASSWORD]`, and set a strong `JWT_SECRET`. `DATABASE_URL` is the transaction-mode pooler for the API; `DIRECT_URL` is the session-mode pooler Prisma uses for migrations.
2. Install dependencies: `npm install`.
3. Generate Prisma client: `npm run db:generate`.
4. Create the database schema: `npm run db:migrate -- --name init`.
5. Load demo data: `npm run db:seed`.
6. Start both apps: `npm run dev`.

Open `http://localhost:5173`. Seed users all use password `Password123!`:

- `admin@oms.local` (Admin)
- `designer@oms.local` (Employee)
- `maker@oms.local` (Employee)

## Checks

`npm run build` type-checks and builds both apps. `npm test` runs the workflow-unit test. API endpoints are described in [API.md](API.md).
