# OMS implementation plan

## Data model

- `User`: Admin/Manager/Staff identity and active state.
- `Order`: customer details, production instructions, quantity, priority, type, unique serial sequence, due date and current status.
- `OrderStatusHistory`: append-only transition record with the actor and optional note.
- `OrderAssignment`: current order/user assignments with assignment timestamps. Reassignment atomically replaces current membership.
- `FileRecord`: provider-neutral metadata (`name`, `url`, MIME type and kind); a future storage provider only needs to produce the URL/metadata.
- `Shipment`: one optional shipping record per order, kept separate so production data is not overloaded.

## API shape

Routes are resource-oriented under `/api`. JWT authentication is checked centrally; Admin-only operations use a dedicated role guard. Every active authenticated user can change any order to any other supported status, including reopening completed/cancelled orders. All roles can assign/reassign during Making; the API locks the order while checking its stage and replacing the assignment. Staff can edit details only on assigned orders. Managers and Admins access workload reports. Every accepted transition updates `Order.status` and appends an `OrderStatusHistory` record in the same database update.

## Frontend pages and components

| Page | Components | Purpose |
| --- | --- | --- |
| Login | `Login` | Establishes JWT session |
| Dashboard | `Dashboard`, `OrderTable`, `Badge` | Workload by lifecycle stage and recently changed orders |
| Orders | `Orders`, `OrderTable`, `Badge` | Search and status-filter the order queue |
| Create order | `NewOrder` | Capture a manual order |
| Order detail | `Detail`, `Badge` | Review details, assignments, workflow timeline and status history; advance workflow when authorized |

The first MVP keeps state local to pages and uses Axios directly through `api.ts`. This avoids adding client-state libraries before the operations need them.

## Added operations

The directory includes priority/type/user/date filters, stable sorting and pagination. Reports summarize current assignment workload. Admin settings manage users/roles and persistent aging thresholds. Legacy statuses remain valid; migrations add new statuses without rewriting historical events.
