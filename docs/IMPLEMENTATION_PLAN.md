# OMS implementation plan

## Data model

- `User`: Admin/Employee identity and active state.
- `Order`: customer details, production instructions, quantity, priority, due date and current status.
- `OrderStatusHistory`: append-only transition record with the actor and optional note.
- `OrderAssignment`: many-to-many order/team membership.
- `FileRecord`: provider-neutral metadata (`name`, `url`, MIME type and kind); a future storage provider only needs to produce the URL/metadata.
- `Shipment`: one optional shipping record per order, kept separate so production data is not overloaded.

## API shape

Routes are resource-oriented under `/api`. JWT authentication is checked centrally; Admin-only operations use a dedicated role guard. Employees may advance an order only when assigned to it, and only one lifecycle stage at a time. Every accepted transition updates `Order.status` and appends an `OrderStatusHistory` record in the same database update.

## Frontend pages and components

| Page | Components | Purpose |
| --- | --- | --- |
| Login | `Login` | Establishes JWT session |
| Dashboard | `Dashboard`, `OrderTable`, `Badge` | Workload by lifecycle stage and recently changed orders |
| Orders | `Orders`, `OrderTable`, `Badge` | Search and status-filter the order queue |
| Create order | `NewOrder` | Capture a manual order |
| Order detail | `Detail`, `Badge` | Review details, assignments, workflow timeline and status history; advance workflow when authorized |

The first MVP keeps state local to pages and uses Axios directly through `api.ts`. This avoids adding client-state libraries before the operations need them.
