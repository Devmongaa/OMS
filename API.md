# API reference

Base URL: `/api`. Send `Authorization: Bearer <token>` on protected endpoints. Active user and current role are checked on every request.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Returns JWT and current user |
| GET | `/auth/me` | Authenticated | Current user |
| GET | `/orders` | Authenticated | Paginated orders; Staff are scoped to their assignments |
| POST | `/orders` | Authenticated | Create a New order; Staff creators are automatically assigned |
| GET | `/orders/:id` | Admin/Manager or assigned Staff | Details, history, assignment time and age |
| PATCH | `/orders/:id` | Admin/Manager or assigned Staff | Edit order |
| DELETE | `/orders/:id` | Admin | Delete order |
| POST | `/orders/:id/status` | Admin/Manager or assigned Staff | Update status and append history |
| POST | `/orders/:id/assignments` | Admin/Manager | `{ "userId": "..." }` replaces current assignments; New becomes Assigned |
| POST | `/orders/:id/files` | Admin/Manager or assigned Staff | Record file metadata/URL |
| POST | `/orders/:id/shipments` | Admin/Manager or assigned Staff | Update shipment |
| GET | `/dashboard` | Authenticated | Status counts and recent orders, scoped for Staff |
| GET | `/reports/workload` | Admin/Manager | Current assignment totals and status/priority counts per user |
| GET | `/users` | Admin/Manager | Active assignment candidates |
| GET | `/admin/users` | Admin | All users including inactive accounts |
| POST/PATCH | `/users`, `/users/:id` | Admin | Create/edit users, roles and active state |
| GET/PUT | `/settings/aging` | Authenticated / Admin | Read/update inclusive aging thresholds |

Order/report filters: `q`, `status`, `assigneeId`, `priority` (0 Low, 1 Medium, 2 High, 3 Urgent), `orderType`, `from`, `to` (UTC creation dates, YYYY-MM-DD, inclusive). Order lists also accept `page`, `limit` (maximum 100), `sort` (`serialNumber`, `createdAt`, `priority`, `status`, `age`), and `direction` (`asc`, `desc`). Reports count current assignments, include zero-workload users, and combine High/Urgent in `highPriority`.

Status body: `{ "status": "IN_PROGRESS", "note": "Work started" }`. Staff can move unfinished orders to In Progress, Pending, or Completed, or advance legacy production stages one step. Admin/Manager can change to any different supported status. Completed/Cancelled cannot be reopened by Staff.

Aging body: `{ "greenDays": 1, "yellowDays": 3, "orangeDays": 5 }`. Values must be nonnegative, strictly increasing integers. Older unfinished orders are red. Age uses whole elapsed days from creation. Terminal orders have `ageColor: null`.

User roles: `ADMIN`, `MANAGER`, `EMPLOYEE` (Staff). New users require name, email, role, and a password of at least 10 characters. Admins cannot deactivate or demote their own account.

Errors use `{ "error": { "message": "Human-readable explanation" } }` with 400 validation, 401 authentication, 403 authorization, 404 missing record, or 409 conflict.

## Performance-related response changes

- `GET /health` aliases `/api/health` and never queries the database.
- `GET /api/orders` keeps pagination but returns table fields and assigned user IDs/names only. Fetch `/api/orders/:id` for descriptions, contact information, shipments, files and history.
- `GET /api/dashboard` returns `{ total, byStatus, byPriority, overdue, recent, attention, workload }`. Recent and attention orders are bounded to six and four respectively. All data respects the caller's order permissions.
- `GET /api/reports/workload` now returns `{ items, total, page, limit, summary }`, rather than a bare array. `page` defaults to 1; `limit` defaults to 20 and is capped at 100. Existing order filters apply. `summary` contains total/pending/completed counts across all filtered users, not just the current page. Each user row includes `overdue`.
- File registration accepts HTTP(S) URLs up to 2,048 characters. It does not upload binary files.
- Error responses retain `{ error: { message } }`. Production clients receive no SQL text or stack trace. Responses use `Cache-Control: no-store`.

Order permissions: POST /api/orders accepts every authenticated role. Staff-created orders are assigned to the creator. PATCH /api/orders/:id accepts Admins/Managers and currently assigned Staff; assignment scope is rechecked in the update query. DELETE remains Admin-only.
