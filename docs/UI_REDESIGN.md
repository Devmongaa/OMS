# OMS interface redesign

This change is presentation-only. Existing API calls, routes, role checks, assignment rules, status transitions, and metric calculations remain intact. Backend source files were compared with their contents at the start of this redesign and were unchanged.

## Frontend audit

| View | Route | Presentation changes |
| --- | --- | --- |
| Login | Unauthenticated routes | Restrained light layout, consistent fields, existing password toggle |
| Dashboard | `/` | Compact existing KPIs, stronger pending/high-priority/overdue emphasis, attention before recent activity |
| Orders | `/orders` | Dense table, actual order references, shared-view tabs, search/filter/sort controls, explicit SLA labels |
| Create order | `/orders/new` | Grouped customer/production fields, compact checklist, consistent actions |
| Order details and editing | `/orders/:id` | Identity/status/priority/SLA grouping, explicit current status, assignment and edit controls, saving feedback |
| Reports | `/reports` | Dense workload table, pinned team-member column when scrolling, existing summaries and calculations |
| Users | `/admin` | Consistent member table, role controls, account form, feedback states |
| Aging settings | `/admin#settings` | Structured threshold form using existing values and validation |

## Shared design system

`apps/web/src/styles.css` owns color, type, radius, shadow, and spacing tokens plus component styles. `apps/web/src/responsive.css` owns layout breakpoints. Previous layered green/purple overrides were replaced rather than extended.

- Background `#F8FAFC`, surface `#FFFFFF`, text `#111827`, secondary text `#64748B`.
- Accent `#2563EB`, borders `#E2E8F0`, success `#15803D`, warning `#D97706`, critical `#DC2626`.
- Locally hosted Inter regular and semibold, with its SIL Open Font License in `apps/web/public/fonts/LICENSE.txt`.
- 6–10px radii, restrained borders and shadows, no gradients or decorative illustrations.
- Shared badges, age labels, page headers, metrics, tables, empty/error/loading states, icons, and dialogs remain in `ui.tsx`.
- Aging labels use the API's existing `ageColor` and `ageDays`; no threshold is inferred or recomputed.

## Responsive and accessibility checks

Browser preview used temporary local fixtures with the real application components and mocked API responses; no production records were modified. The fixtures were removed after verification.

All eight views were checked at **1440, 1024, 768, and 375px**. All 32 combinations matched the requested viewport and had no page-level horizontal overflow. Wide reports stay horizontally scrollable inside their region; mobile orders use compact separated list rows.

Also inspected expanded filters, order editing, staff read-only details, desktop order scanning, mobile settings, loading/empty/error states, and the password visibility toggle. Verified that Escape dismisses the mobile drawer and restores focus to its toggle. Existing drawer focus trapping, skip link, dialog semantics, form labels, keyboard links, and reduced-motion handling are retained. Touch devices use larger controls.

The second visual pass refined section spacing, active order-detail navigation, current-status clarity, report column pinning, and filter labels.

## Checks

- `npm run build`: API and frontend compile/build.
- `npm test`: existing API unit tests plus five frontend presentation regression tests.
- `git diff --check`: whitespace/conflict-marker check.
- No lint script is configured in the repository.

The frontend regression tests cover server-provided aging, terminal order display, identity/assignment/action preservation, customer-text escaping, empty-state actions, accessible feedback roles, and role-based navigation. Visual verification used representative fixtures and is not an end-to-end test against a live database.
