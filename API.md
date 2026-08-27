# API reference

Base URL: `/api`. Send `Authorization: Bearer <token>` on protected endpoints.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Returns JWT and current user |
| GET | `/auth/me` | Authenticated | Current user |
| GET/POST | `/orders` | Authenticated | List (with `q`, `status`, `assigneeId`, `page`, `limit`) / create |
| GET/PATCH | `/orders/:id` | Authenticated | Detail / update basic order fields |
| POST | `/orders/:id/status` | Admin or assigned employee | Move to the next workflow state; creates history |
| POST | `/orders/:id/assignments` | Admin | Assign employee |
| DELETE | `/orders/:id/assignments/:userId` | Admin | Remove assignment |
| POST | `/orders/:id/files` | Authenticated | Record external file metadata or URL |
| POST | `/orders/:id/shipments` | Admin or assigned employee | Add/update shipment details |
| GET | `/dashboard` | Authenticated | Counts by status and recent orders |
| GET | `/users` | Admin | Employees for assignment selection |

### Error shape

```json
{ "error": { "message": "Human-readable explanation" } }
```

### Status change body

```json
{ "status": "DESIGNING", "note": "Artwork queued" }
```

Only the next state in the lifecycle is accepted, except an Admin may set a prior state to correct an operational error.
