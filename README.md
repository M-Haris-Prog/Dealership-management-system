# Gateway Motors DMS

Industrial Dealer Management System for Gateway Motors Faisalabad.

## Stack

- React + TypeScript + Vite (`apps/web`)
- Node.js + NestJS + TypeScript (`apps/api`)
- MySQL 8.x through Prisma (`apps/api/prisma`)
- Redis for queues, rate limiting, and coordination

## First milestone

The current milestone establishes:

- A responsive industrial dashboard shell for the Director/Management view.
- The NestJS API foundation with `GET /api/health`.
- Prisma schema foundations for identity, RBAC, audit, accounting, fiscal periods, and stock locking.
- Authentication and permission foundations (`/api/auth/*`).
- Transactional journal posting (`POST /api/finance/journal-entries`).
- Transactional stock receive/issue primitives (`POST /api/inventory/receive`, `/api/inventory/issue`).
- Sales foundation endpoints for customers, vehicles, leads, and bookings.
- Spare Parts / Inventory foundation with catalog, suppliers, stock, and movement commands.
- Mechanical Service foundation with job cards, estimates, technicians, parts requests, labor, inspections, and invoice-ready summaries.
- Body & Paint foundation with repair orders, insurance, damage assessment, approvals, operations, vehicle movements, materials, and invoice-ready summaries.
- Accounts & Finance expansion with controlled journals, receivables, payables, expenses, bank transactions, reconciliation, reversals, and reporting summaries.
- Cashier Management with sessions, receipts, vouchers, cash movements, reconciliation, closing, and controlled reversals.
- Dashboard, Reporting, and Administration with cross-module KPIs, drill-downs, exports, approvals, audit search, and access management.
- Platform foundation security services with refresh-token rotation, privileged-user MFA, numbering sequences, notifications, secure private attachment metadata/storage, and generic approval requests.
- Local MySQL and Redis infrastructure definitions.

## Run the frontend

```powershell
cd apps/web
npm install
npm run dev
```

## Run the API

Copy `apps/api/.env.example` to `apps/api/.env`, then install dependencies and run:

```powershell
cd apps/api
npm install
npm run prisma:generate
npm run start:dev
```

The health endpoint is `http://localhost:3000/api/health`.

Authentication and finance/inventory commands require a seeded user, roles, permissions, chart of accounts, fiscal period, and locations. The deterministic seed script is ready and requires MySQL to be available.

Sales API routes are protected and available under:

```text
GET/POST /api/sales/customers
GET/POST /api/sales/vehicles
GET/POST /api/sales/leads
GET/POST /api/sales/bookings
```

Parts API routes are protected and available under:

```text
GET/POST /api/parts
GET/POST /api/parts/suppliers
GET      /api/parts/stock
POST     /api/parts/receive
POST     /api/parts/issue
POST     /api/parts/return
```

Mechanical Service routes are protected and available under:

```text
GET/POST /api/service/job-cards
POST     /api/service/job-cards/:id/estimates
POST     /api/service/estimates/:id/approve
POST     /api/service/job-cards/:id/technician
POST     /api/service/job-cards/:id/parts
POST     /api/service/job-cards/:id/labor
POST     /api/service/job-cards/:id/status
POST     /api/service/job-cards/:id/inspection
GET      /api/service/job-cards/:id/invoice-ready
```

Body & Paint routes are protected and available under:

```text
GET/POST /api/body-paint/repair-orders
POST     /api/body-paint/repair-orders/:id/insurance-case
POST     /api/body-paint/repair-orders/:id/damage-assessment
POST     /api/body-paint/repair-orders/:id/approval
POST     /api/body-paint/repair-orders/:id/operations
PUT      /api/body-paint/operations/:id
POST     /api/body-paint/repair-orders/:id/vehicle-movement
POST     /api/body-paint/repair-orders/:id/material-consumption
PUT      /api/body-paint/repair-orders/:id/status
GET      /api/body-paint/repair-orders/:id/invoice-ready
```

Accounts & Finance routes are protected and available under:

```text
GET  /api/finance/accounts
GET  /api/finance/fiscal-periods
GET  /api/finance/receivables
GET  /api/finance/payables
GET  /api/finance/trial-balance
GET  /api/finance/accounts/:id/ledger
POST /api/finance/journal-entries
POST /api/finance/journal-entries/:id/post
POST /api/finance/journal-entries/:id/reverse
POST /api/finance/expenses
POST /api/finance/expenses/:id/approve
POST /api/finance/expenses/:id/post
POST /api/finance/bank-transactions
POST /api/finance/reconciliations
```

Cashier routes are protected and available under:

```text
POST /api/cashier/sessions?branchId=:branchId
GET  /api/cashier/sessions
GET  /api/cashier/sessions/:id
POST /api/cashier/sessions/:id/close
POST /api/cashier/sessions/:id/cash-in
POST /api/cashier/sessions/:id/cash-out
POST /api/cashier/sessions/:id/receipts
POST /api/cashier/sessions/:id/payment-vouchers
POST /api/cashier/sessions/:id/reconciliation
POST /api/cashier/transactions/:id/reversal
```

Reporting and administration routes are protected and available under:

```text
GET  /api/reporting/kpis
GET  /api/reporting/summary
GET  /api/reporting/drilldown/:source
GET  /api/reporting/metadata
POST /api/reporting/export/:source
GET  /api/admin/users
POST /api/admin/users/:id/access
GET  /api/admin/roles
GET  /api/admin/permissions
GET  /api/admin/audit
GET  /api/admin/approvals
POST /api/admin/approvals/:kind/:id/decision
```

Platform foundation routes are protected and available under:

```text
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/mfa/setup
POST /api/auth/mfa/confirm
POST /api/auth/mfa/disable
GET  /api/foundation/notifications
POST /api/foundation/notifications
POST /api/foundation/notifications/:id/read
POST /api/foundation/attachments
GET  /api/foundation/attachments/:id
POST /api/foundation/approval-requests
GET  /api/foundation/approval-requests
POST /api/foundation/approval-requests/:id/decision
```

Sales lifecycle routes are protected and available under:

```text
GET  /api/sales/bookings/:id
GET  /api/sales/leads/:id/activities
POST /api/sales/leads/:id/activities
POST /api/sales/lead-activities/:id/complete
GET  /api/sales/bookings/:id/payment-schedule
POST /api/sales/bookings/:id/payment-schedule
GET  /api/sales/bookings/:id/documents
POST /api/sales/bookings/:id/documents
GET  /api/sales/bookings/:id/requests
POST /api/sales/bookings/:id/requests
POST /api/sales/booking-requests/:id/decision
GET  /api/sales/invoices
POST /api/sales/bookings/:id/invoice
POST /api/sales/invoices/:id/post
GET  /api/sales/bookings/:id/payments
POST /api/sales/bookings/:id/payments
POST /api/sales/bookings/:id/delivery
GET  /api/sales/reports
```

Parts and inventory routes are protected and available under:

```text
GET  /api/parts
GET  /api/parts/categories
POST /api/parts/categories
GET  /api/parts/stock
GET  /api/parts/stock/low-stock
POST /api/parts/receive
POST /api/parts/issue
POST /api/parts/return
POST /api/parts/transfer
POST /api/parts/adjust
GET  /api/parts/movements
GET  /api/parts/suppliers
POST /api/parts/suppliers
GET  /api/parts/purchase-orders
POST /api/parts/purchase-orders
POST /api/parts/purchase-orders/:id/receive
```

After MySQL is running and the migration has been applied, set `SEED_ADMIN_PASSWORD` in `apps/api/.env` and run:

```powershell
cd apps/api
npm run prisma:migrate:deploy
npm run prisma:seed
```

The seed command is deterministic and refuses to run without a development admin password of at least 12 characters.

## Local services

```powershell
docker compose up -d mysql redis
```

The implementation plan is in [`plan.md`](./plan.md). Business modules will be delivered in milestones; the dashboard currently uses clearly marked presentation data until real API query endpoints are implemented.
