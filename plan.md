# Gateway Motors DMS — Execution Plan

## 1. Purpose and scope

Build a secure, integrated Dealer Management System for Gateway Motors Faisalabad using:

- **Frontend:** React.js with TypeScript
- **Backend:** Node.js with TypeScript and a REST API
- **Database:** MySQL 8.x
- **Business scope:** Six business modules plus shared platform capabilities

The system must connect Sales, Mechanical Service, Body & Paint, Spare Parts, Accounts & Finance, and Cashier Management without allowing departments to bypass permissions, approvals, accounting controls, or audit history.

### 1.1 Core business modules

1. Sales Management
2. Mechanical Workshop / Service Management
3. Body & Paint Management
4. Spare Parts / Inventory Management
5. Accounts & Finance
6. Cashier Management

### 1.2 Shared platform capabilities

- Role-based access control (RBAC)
- Approval workflows and segregation of duties
- Audit trail and activity logs
- Management dashboard and reporting
- Document and attachment security
- Notifications and exception alerts
- Administration and configuration
- Backup, recovery, monitoring, and data export

## 2. Delivery principles

- Deliver a usable vertical slice first, then expand module by module.
- Keep financial, inventory, and operational records traceable to their source documents.
- Never hard-delete posted financial, stock, booking, or job-card transactions.
- Use maker-checker approval for sensitive actions and prevent self-approval where configured.
- Enforce access in the backend; frontend visibility is not a security boundary.
- Use database transactions for operations that update more than one business record.
- Make important status changes explicit and auditable.
- Prefer configuration for roles, approval limits, numbering, taxes, and departments rather than hard-coded rules.
- Demonstrate every end-to-end acceptance scenario in a production-like staging environment before go-live.

## 3. Target architecture

### 3.1 Recommended repository structure

```text
dms/
  apps/
    web/                 # React application
    api/                 # Node.js API
    worker/              # background jobs and notifications
  packages/
    contracts/           # shared DTOs, validation schemas, API types
    config/              # shared configuration and environment parsing
  database/
    migrations/
    seeds/
    reference-data/
  infrastructure/
    docker/
    deployment/
  docs/
    requirements/
    architecture/
    operations/
  tests/
    e2e/
```

### 3.2 Backend design

Use a modular monolith initially. This keeps cross-module transactions reliable and reduces operational complexity while allowing later extraction of services if scale requires it.

- Node.js LTS + TypeScript
- NestJS as the backend framework
- REST API with OpenAPI documentation
- Prisma for standard tables, migrations, and CRUD data access
- Raw parameterized SQL for accounting posting and stock locking operations
- Redis as the selected infrastructure component for rate limiting, queues, short-lived cache, and worker coordination
- Background worker for notifications, report exports, backups, and scheduled alerts
- Central error handling, request validation, structured logs, and correlation IDs

Recommended API layers:

1. Controller and request validation
2. Authorization/policy guard
3. Application service/use case
4. Domain rules and workflow transitions
5. Repository/data-access layer
6. Audit and event recording
7. Response mapping

### 3.3 Frontend design

- React.js + TypeScript
- Vite for development and production builds
- React Router for protected module routes
- TanStack Query for server state and cache invalidation
- React Hook Form + Zod for forms and validation
- A consistent component library and design system
- Responsive desktop-first layout suitable for dealership office and workshop use
- Route-level permission guards and action-level permission checks
- Server-side pagination, filtering, sorting, and export requests
- Accessible forms, keyboard navigation, confirmation dialogs, and clear error states

Main UI areas:

- Login, MFA, password recovery, and session management
- Role-aware navigation and dashboard
- Global customer/vehicle search subject to permissions
- Module workspaces
- Approval inbox
- Notifications and alerts
- Audit viewer
- Administration

### 3.4 MySQL design

- MySQL 8.x with UTF-8 (`utf8mb4`)
- InnoDB tables and foreign keys
- UTC timestamps stored in the database; display Asia/Karachi by default
- UUID or carefully managed numeric IDs for public references; human-readable document numbers separately
- Migration files committed to source control
- Separate development, staging, and production databases
- Database-level uniqueness and referential constraints for critical records
- Soft archival/status fields for business records; no deletion of posted transactions

## 4. Environments and release flow

1. **Local:** Docker Compose for MySQL and Redis; seeded demo data.
2. **Development:** shared environment for integration work; sanitized data only.
3. **Staging/UAT:** production-like configuration, realistic roles, approval limits, and test data.
4. **Production:** private network, managed MySQL, encrypted backups, monitoring, and controlled deployment.

Promotion flow:

```text
feature branch → pull request → automated checks → development
→ staging/UAT approval → release candidate → production
```

No production migration should run without a reviewed rollback/restore plan.

## 5. Functional implementation plan

### Phase 0 — Discovery and solution baseline

Before coding, confirm the following with Gateway Motors:

- Branches, departments, stores, locations, and expected user count
- Customer, vehicle, model, VIN/chassis, engine, and registration data structure
- Chart of accounts, fiscal year, taxes, payment methods, and numbering rules
- Booking, invoice, receipt, job-card, purchase-order, and stock-document formats
- Approval limits and approver hierarchy
- Warranty, insurance, discounts, refunds, deductions, and credit-sale rules
- Required document types and attachment retention requirements
- Hosting location, support access, backup retention, recovery targets, and data export
- Migration sources and data-cleaning responsibilities
- Whether barcode scanners, printers, biometric devices, SMS, email, or payment integrations are needed

Outputs: signed requirements baseline, process maps, permission matrix, data dictionary, wireframes, acceptance-test catalogue, and release roadmap.

### Phase 1 — Platform foundation

Build the shared foundation before business modules:

- Authentication with unique employee accounts
- Password policy, session timeout, refresh-token rotation, and mandatory MFA for Director/Managing Director, System Administrator, and Accounts Manager
- Users, roles, departments, branches, locations, and permission assignments
- Permission verbs: view, create, edit, approve, export, reverse, and delete/archive where allowed
- Backend authorization middleware and record-scope policies
- Numbering/configuration engine
- Approval workflow engine with requester, approver, decision, reason, and timestamps
- Append-only audit event service. The application database user has INSERT and SELECT only on audit tables, with no UPDATE or DELETE access; ordinary application roles have no DELETE permission on financial or posted transaction tables.
- Attachment metadata, secure storage abstraction, optional virus-scanning adapter, and access logging
- Notification and alert framework
- Common customer, vehicle, vendor, employee, and document-search components
- Dashboard shell, navigation, error handling, loading states, and empty states
- Chart of accounts, fiscal periods, tax-code foundation, posting configuration, and document numbering
- Core journal-posting service used by all later modules; posting runs in a MySQL transaction and records source-document references
- Minimal stock ledger and stock-balance table with locking-safe issue/receive primitives

The accounting posting service and minimal stock ledger are foundation capabilities, not later-phase add-ons. Reports and financial statements can be delivered later, but every module must be able to post controlled source-linked entries from its first release.

### Phase 2 — Sales Management

Deliver the sales lifecycle:

- Customer and prospect records
- Leads, assignments, follow-ups, notes, and communication history
- Vehicle/model stock, availability, reservations, and allocation
- Booking creation, documents, payment schedule, and status history
- Booking approval rules
- Vehicle invoice and delivery workflow
- Cancellation, refund, deduction, discount, and allocation-change requests
- Salesperson and Sales Manager views
- Sales performance, conversion, booking, cancellation, and delivery reports
- Sales-to-Accounts posting for deposits, invoices, receivables, receipts, cancellations, refunds, and delivery-related entries

Every booking/payment/invoice/delivery record must retain links to the customer, vehicle, responsible salesperson, approvals, and accounting entries.

### Phase 3 — Spare Parts / Inventory foundation

Build Parts before Mechanical Service because Service depends on parts requests and issues:

- Parts master, categories, units, suppliers, and locations
- Purchase orders and goods receipt
- Stock ledger, stock balances, issues, returns, transfers, and adjustments
- Job-card-ready parts requests and issue transactions
- Minimum/maximum stock levels and low-stock alerts
- Inventory valuation foundation and movement history
- Parts-to-Accounts cost and payable posting

For every stock issue or receipt, use a transaction equivalent to:

```sql
START TRANSACTION;
SELECT quantity FROM stock_balances
WHERE part_id = ? AND location_id = ?
FOR UPDATE;
-- validate quantity and write stock_transactions / new balance
COMMIT;
```

The implementation must use the equivalent Prisma transaction plus raw SQL row lock, with indexes and deadlock retry handling.

### Phase 4 — Mechanical Service

- Customer and vehicle service history
- Vehicle check-in and check-out
- Job cards/repair orders with status state machine
- Estimates and customer approvals
- Technician allocation and labor operations
- Parts requests against job cards
- Service packages and warranty jobs
- Inspection checklist, final inspection, and delivery
- Service invoice, receipt, outstanding amount, and history
- Workshop workload, revenue, pending-work, and performance reports
- Service-to-Accounts posting for labor, parts, invoices, receipts, warranty adjustments, and receivables

### Phase 5 — Body & Paint

Keep this as a separate operational workflow and permission scope from Mechanical Service:

- Accident/repair job cards
- Insurance case and policy information
- Estimate and insurance/customer approvals
- Separate insurance and customer-payable amounts
- Denting, painting, labor, and technician assignments
- Parts and paint-material requirements/consumption
- Vehicle movement and repair-progress tracking
- Final inspection, invoice, payment, and delivery
- Body & Paint history and performance reports

### Phase 6 — Accounts & Finance expansion

- Chart of accounts and fiscal periods
- General ledger and subsidiary ledgers
- Customer/vendor receivables and payables
- Journal entries with posting controls
- Department and cost/revenue classification
- Expense claims and expense payments
- Bank and cash transactions
- Sales, Service, Body & Paint, Parts, and Cashier integration
- Reconciliation, correction, reversal, and approval flows
- Financial statements and management reports
- Period closing and restricted post-close changes

All postings must use the Phase 1 controlled posting service rather than allowing operational users to edit ledger rows directly. This phase expands the foundation into full finance screens, reconciliation, statements, and reporting.

### Phase 7 — Cashier Management

- Cashier opening balance
- Cash receipts and payments
- Customer, sales, service, and parts receipts
- Payment vouchers
- Numbered receipts and printable output
- Cash-in/cash-out
- Daily closing and reconciliation
- Cashier-wise history and discrepancy reports
- Controlled reversal/correction linked to the original transaction

Cashier permissions must explicitly prohibit deletion of posted receipts, invoice changes, ledger changes, and self-approval of restricted reversals/refunds.

### Phase 8 — Dashboard, reporting, and administration

- Director dashboard across all six business modules
- Drill-down from KPI to permitted source transactions
- Daily, monthly, and annual report filters
- Excel/PDF exports controlled by permission
- Difference between bookings, invoiced sales, cash received, outstanding, revenue, and profit
- Configurable basis for profitability calculations
- User/role/department/permission administration
- Approval limits and workflow administration
- Audit search and authorized export
- Data export and operational configuration screens

## 6. Key data model

The following entities should be designed in the data dictionary before migrations are written:

### Platform and security

`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `departments`, `branches`, `locations`, `approval_rules`, `approval_requests`, `audit_events`, `login_events`, `attachments`, `notifications`, `system_settings`.

### Shared master data

`customers`, `customer_documents`, `vehicles`, `vehicle_models`, `vehicle_stock`, `vendors`, `employees`, `payment_methods`, `tax_codes`, `cost_centers`.

### Sales

`leads`, `lead_activities`, `bookings`, `booking_documents`, `booking_payments`, `vehicle_allocations`, `sales_invoices`, `deliveries`, `sales_cancellations`, `refund_requests`.

### Service and Body & Paint

`job_cards`, `job_card_tasks`, `estimates`, `estimate_lines`, `estimate_approvals`, `technician_assignments`, `inspections`, `service_invoices`, `warranty_cases`, `insurance_cases`, `vehicle_movements`, `repair_materials`.

### Parts and inventory

`parts`, `part_categories`, `suppliers`, `purchase_orders`, `goods_receipts`, `stock_transactions`, `stock_counts`, `stock_adjustment_requests`, `parts_requests`, `parts_issues`, `parts_returns`.

### Finance and cashier

`accounts`, `journal_entries`, `journal_lines`, `receivables`, `payables`, `expenses`, `bank_transactions`, `cashier_sessions`, `cashier_transactions`, `receipts`, `payment_vouchers`, `reconciliations`, `reversals`, `fiscal_periods`.

Every important entity needs status, created/updated attribution, timestamps, and a business reference number where appropriate. Posted records should be immutable except through controlled reversal or correction processes.

## 7. API and workflow standards

Use versioned endpoints under `/api/v1`. Organize endpoints by business capability, for example:

```text
/auth
/users /roles /permissions
/customers /vehicles /vendors
/sales/leads /sales/bookings /sales/deliveries
/service/job-cards /service/estimates /service/invoices
/body-paint/jobs /body-paint/insurance-cases
/parts/items /parts/purchase-orders /parts/stock
/finance/accounts /finance/journals /finance/receivables
/cashier/sessions /cashier/receipts /cashier/reconciliation
/approvals /audit /reports /attachments
```

API requirements:

- OpenAPI specification generated and kept current.
- Consistent response envelope and error codes.
- Request validation for every write endpoint.
- Idempotency keys for payment, receipt, posting, and other retry-sensitive operations.
- Pagination and filter limits on list endpoints.
- Optimistic concurrency/version checks for editable workflows.
- Database transaction boundaries around multi-record business operations.
- Authorization checks on both action and record scope.
- No sensitive fields in logs or error responses.

Implement workflow transitions as explicit commands, such as `submit`, `approve`, `reject`, `post`, `reverse`, `close`, and `deliver`, rather than allowing arbitrary status updates.

## 8. Security and compliance controls

- Hash passwords with Argon2id or an equivalent modern password hash.
- Use HTTPS everywhere outside local development.
- Store secrets in environment/secret management, never in source control.
- Encrypt sensitive attachments and sensitive customer fields at rest. CNIC values must use field-level authenticated encryption, with a separate keyed-hash lookup column for duplicate detection without exposing the plaintext value.
- MFA is mandatory for Director/Managing Director, System Administrator, and Accounts Manager; it is available for all other users where configured.
- Use short-lived access tokens and rotated refresh tokens with secure, HTTP-only cookies.
- Apply rate limits to login, password recovery, exports, and public-facing endpoints.
- Log successful and failed login attempts and sensitive document access.
- Scope data by dealership/branch/department where applicable.
- Restrict CNIC and financial attachments by explicit permission.
- Mask sensitive information in lists and exports unless the user is authorized.
- Use least privilege for application, database, deployment, and support accounts.
- Back up encrypted data and regularly test restoration.
- Retain audit records according to the approved retention policy.
- Run dependency, secret, static-analysis, and vulnerability checks in CI.

### Database-level audit and posting controls

- The audit schema is append-only for the application database account: `INSERT` and `SELECT` only; no `UPDATE` or `DELETE` grants.
- Financial, receipt, journal, stock-ledger, and posted business tables have no DELETE permission for the application runtime account. Corrections use reversal/correction records.
- Administrative database credentials are separate, break-glass credentials with access logged and reviewed.
- Audit records include actor, role, department, action, entity, before/after values where permitted, source reference, IP/device metadata where lawful, and timestamp.

### Pakistan tax and FBR risk

Tax and FBR requirements are a headline discovery and estimation risk, not a minor configuration bullet. Before invoice development, confirm:

- Applicable sales tax, withholding, and dealership-specific tax rules
- FBR invoice fields, numbering, QR/e-invoicing requirements, and integration obligations
- Whether sales, service, parts, and insurance/customer invoices have different tax treatment
- Tax-period closing, amendment, cancellation, and credit/debit-note rules
- Required integration ownership, credentials, sandbox access, and certification process

No production invoice format or tax calculation should be treated as final until Gateway Motors’ accountant/tax adviser confirms these rules.

## 9. Testing strategy

### 9.1 Automated checks

- Unit tests for validation, calculations, permission policies, numbering, approval rules, and accounting logic.
- Integration tests with a disposable MySQL database for repositories and transaction boundaries.
- API tests for authentication, authorization, posting, reversal, and cross-module links.
- React component and form tests for critical screens and error states.
- End-to-end tests for the eight original acceptance scenarios.
- Migration and seed-data verification.
- Performance tests for dashboard queries, search, posting, and concurrent cashier activity.
- Security tests for unauthorized record access, IDOR, privilege escalation, injection, file access, and session handling.

### 9.2 Original end-to-end acceptance scenarios

Keep these as eight business-level tests, with detailed steps beneath each:

1. Sales booking, payment, receipt, vehicle invoice, and delivery.
2. Mechanical job card, parts request/issue, labor, invoice, payment, and inventory/accounts verification.
3. Body & Paint repair with insurance/customer split, paint-material consumption, inspection, invoice, and delivery.
4. Cashier opening, receipts/payments, closing, reconciliation, and controlled correction/reversal.
5. Salesperson access restriction from another salesperson’s confidential customer records.
6. Protection of posted transactions and audit logs from ordinary-user deletion or modification.
7. Director dashboard drill-down from summary figures to source transactions.
8. Denial and logging of unauthorized access to customer records and attachments.

Each test must verify both the visible result and the persisted effects in the relevant modules.

### 9.3 Required negative and boundary tests

- Duplicate customer and duplicate receipt prevention.
- Payment amount greater than outstanding amount according to configured rules.
- Attempted self-approval.
- Attempted deletion of posted records.
- Stock issue above available quantity.
- Stock adjustment without approval.
- Editing a closed fiscal period.
- Unauthorized branch, department, customer, attachment, or report access.
- Session expiry during a sensitive operation.
- Failed payment/posting transaction with no partial database update.

## 10. Reporting and operational observability

Build reports from controlled read models or optimized queries rather than duplicating business truth. Every financial report must state its calculation basis.

Minimum operational monitoring:

- API availability and error rate
- Database connection health and slow queries
- Queue/worker failures
- Failed scheduled reports and exports
- Backup success/failure
- Authentication anomalies
- Approval backlog
- Stock and cashier discrepancies
- Disk, memory, and CPU thresholds

Use structured JSON logs with correlation IDs. Provide a support runbook for common failures without exposing customer data.

## 11. Scope boundaries and optional items

The following are optional and must not silently expand the baseline estimate. They require written client confirmation:

- SMS and email notifications
- Virus scanning integration for uploaded attachments
- Offline or poor-connectivity workshop mode
- Barcode/QR scanning and label printing
- Payment gateway, bank, Jetour, FBR, or other external integrations
- Mobile/tablet applications
- Biometric devices and hardware integrations

The baseline plan includes internal notifications, secure attachment storage, and online browser workflows only. If the client confirms an optional item, add a scoped mini-specification, estimate, dependency list, acceptance test, and implementation milestone.

## 12. Deployment and backup plan

- Containerize the API, worker, and frontend build where appropriate.
- Use managed MySQL or a dedicated protected MySQL host in production.
- Keep database and application services on private network segments where possible.
- Terminate TLS at a managed reverse proxy/load balancer.
- Run migrations as an explicit release step with preflight checks.
- Perform automated daily full backups plus an agreed incremental/binlog strategy.
- Encrypt backups and test restoration at least quarterly.
- Define RPO and RTO with the client before production.
- Maintain a documented rollback process for application releases and a restore process for database incidents.
- Keep production data out of development and test environments unless sanitized.

## 13. Data migration and opening balances

Migration is a dedicated workstream, not only a UAT checklist item.

### Migration scope

- Existing customers and customer documents
- Vehicles, models, VIN/chassis and current availability
- Leads, active bookings, and open sales balances
- Open service and Body & Paint jobs
- Parts master, suppliers, locations, and opening stock quantities/costs
- Customers/vendors receivables and payables
- Chart-of-accounts opening balances
- Cashier opening balances and approved carry-forward transactions

### Migration process

1. Inventory all source files/databases and agree ownership of each field.
2. Create a mapping and transformation specification.
3. Clean duplicates, invalid references, missing mandatory fields, and sensitive documents.
4. Import into a disposable migration database and generate exception reports.
5. Rehearse migration in staging and reconcile record counts, stock, receivables, payables, cash, and opening balances.
6. Obtain business-owner sign-off on reconciliation.
7. Freeze source changes, run the production migration, and preserve a read-only archive.
8. Reconcile again after go-live and document unresolved exceptions.

Migration acceptance requires signed reconciliation reports, not just a successful import script.

## 14. Schedule, effort, team, and commercial planning

The following is a planning estimate for one dealership, one production environment, online browser workflows, and the baseline scope. It must be re-estimated after discovery, tax/FBR clarification, integrations, user count, and data inspection.

### Indicative schedule

| Workstream | Duration | Effort guidance | Contingency |
|---|---:|---:|---:|
| Discovery, process mapping, FBR/tax analysis | 2 weeks | 2–3 person-weeks | 1 week |
| Architecture, UX, foundation, RBAC, approvals, audit | 4 weeks | 8–12 person-weeks | 1 week |
| Accounting foundation and posting service | 3 weeks | 5–8 person-weeks | 1 week |
| Sales and cashier vertical slice | 5 weeks | 10–15 person-weeks | 1 week |
| Parts and stock ledger | 4 weeks | 8–12 person-weeks | 1 week |
| Mechanical Service | 5 weeks | 10–15 person-weeks | 1 week |
| Body & Paint | 4 weeks | 8–12 person-weeks | 1 week |
| Accounts expansion, reconciliation, reports | 5 weeks | 10–15 person-weeks | 1 week |
| Dashboard, exports, administration | 3 weeks | 6–9 person-weeks | 1 week |
| Data migration, rehearsal, and reconciliation | 3 weeks, partly parallel | 5–8 person-weeks | 1 week |
| UAT, security, performance, training, go-live | 4 weeks | 8–12 person-weeks | 1 week |

Expected baseline delivery is approximately **36–42 calendar weeks**, depending on parallel staffing and client response time. Reserve an additional **15–20% schedule contingency** for tax/FBR decisions, integrations, data quality, and UAT changes. Do not promise a shorter date until discovery produces a signed backlog and resource plan.

### Recommended delivery team

- 1 Product/Project Manager
- 1 Business Analyst with dealership/accounting experience
- 1 Solution Architect/Tech Lead
- 2 Backend engineers (NestJS/TypeScript)
- 2 Frontend engineers (React/TypeScript)
- 1 Database/data migration engineer
- 1 QA automation engineer
- 1 UI/UX designer, part-time after design baseline
- 1 DevOps/security engineer, part-time
- Gateway Motors process owners for Sales, Service, Body & Paint, Parts, Accounts, and Cashier

### Commercial estimate structure

The final proposal must show separate line items for:

- One-time discovery and solution design
- One-time development by module/workstream
- Data migration and reconciliation
- Integrations, including any FBR/tax work
- Testing, UAT support, training, and documentation
- Deployment and go-live support
- Hosting and managed database fees
- Backup/storage/monitoring fees
- SMS/email/payment/API provider fees
- Annual maintenance and support
- Warranty period and post-warranty change rates

The current workstream table represents approximately **80–121 person-weeks** before final contingency. The proposal should calculate the one-time implementation price as:

```text
approved person-weeks × agreed blended rate
+ approved third-party/integration costs
+ migration and travel expenses, if any
+ contingency reserve approved by the client
```

Recurring fees must separately state monthly and annual amounts for hosting, managed MySQL, backups, monitoring, support, external APIs, and optional add-ons. Support terms must specify business hours, severity definitions, response targets, resolution targets, escalation, included maintenance, warranty defects, and chargeable change requests.

Until user counts, tax rules, integrations, hosting, and source-data quality are confirmed, provide a cost range and assumptions rather than a false fixed price. The proposal must state payment milestones, support response targets, included maintenance, exclusions, and change-request pricing.

## 15. Delivery milestones

### Milestone 1 — Baseline approved

Requirements, workflows, permission matrix, wireframes, data dictionary, hosting decision, and acceptance tests approved.

### Milestone 2 — Platform foundation complete

Authentication, RBAC, audit, approvals, shared masters, chart of accounts, posting service, minimal stock ledger, attachments, API conventions, and CI pipeline working in staging.

### Milestone 3 — Sales and cashier vertical slice

Booking → payment → receipt → invoice/delivery, including cashier session, accounting link, permissions, and audit history.

### Milestone 4 — Mechanical Service and Parts integration

Job card → estimate approval → parts issue → labor → invoice → payment, with stock and accounting updates.

### Milestone 5 — Body & Paint and Parts integration

Repair/insurance workflow, materials, separate permissions, billing, delivery, and consolidated visibility.

### Milestone 6 — Accounts, reporting, and management dashboard

Ledgers, receivables/payables, reconciliation, financial reports, KPIs, drill-down, and exports.

### Milestone 7 — Data migration and reconciliation

Customer, vehicle, open booking/job, parts, stock, receivables/payables, cash, and opening-balance migration rehearsed and reconciled with signed business-owner approval.

### Milestone 8 — UAT and hardening

Complete the eight acceptance tests, security review, performance checks, training, and defect correction.

### Milestone 9 — Go-live and support

Production release, opening balances/data migration, monitored hypercare, support handover, documentation, and post-go-live review.

## 16. Definition of done

A capability is complete only when:

- The user can complete the full intended workflow through the React UI.
- The Node.js API validates and authorizes every action.
- MySQL stores the correct linked records transactionally.
- The operation is auditable and has the required approval behavior.
- Success, validation, permission-denied, duplicate, and failure states are handled.
- Relevant reports and drill-downs show the result correctly.
- Automated tests and manual UAT evidence exist.
- Documentation, migration notes, and support instructions are updated.

## 17. Go-live checklist

- Approved requirements and change-control process
- Confirmed users, roles, permissions, departments, and approval limits
- Verified chart of accounts and numbering sequences
- Completed data cleansing and migration rehearsal
- Tested opening balances and stock balances
- Verified backup restoration
- Completed security and vulnerability review
- Completed performance and concurrency checks
- Completed all eight acceptance scenarios
- Signed UAT approval
- Trained end users, managers, cashiers, storekeepers, and administrators
- Published user and support manuals
- Confirmed support contacts, response targets, warranty, and escalation path
- Prepared rollback and incident communication plan

## 18. Items requiring client confirmation before estimation

These are not assumptions to hide in the implementation estimate:

- Number of users, branches, stores, and concurrent users
- Whether multiple dealerships will be supported later
- Existing data and migration format
- Exact accounting/tax requirements and chart of accounts
- Warranty and insurance business rules
- Approval limits and organizational hierarchy
- Required integrations with Jetour, banks, payment gateways, SMS, email, printers, or scanners
- Barcode/QR requirements for parts and vehicles
- Hosting jurisdiction and support-staff access policy
- Backup retention, RPO, RTO, and disaster-recovery expectations
- Required mobile or tablet experience for technicians and managers
- Required offline behavior, if any
- Report templates and Excel/PDF formatting expectations

## 19. Recommended first implementation slice

Start with one complete, demonstrable flow rather than building isolated screens:

```text
Customer → Vehicle → Booking → Payment → Cashier Receipt
→ Vehicle Invoice → Delivery → Accounts Entry → Audit Trail
```

This slice validates the architecture, authentication, permissions, numbering, approval hooks, accounting integration, audit design, reporting links, and React/Node.js/MySQL deployment path before the remaining department workflows are expanded.
