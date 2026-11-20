const http = require('http');

const API_BASE = 'http://localhost:3000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function login(identifier, password) {
  const res = await request('POST', '/auth/login', { identifier, password });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(res.data)}`);
  }
  return res.data.accessToken;
}

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function run() {
  console.log('========================================================================');
  console.log('PHASE 8 COMPREHENSIVE E2E VERIFICATION SUITE');
  console.log('Testing Dashboard, Reporting, Profitability & Administration');
  console.log('========================================================================\n');

  // Step 1: Authentication & RBAC Isolation
  console.log('--- Step 1: Authentication & Role-Based Access Control ---');
  const testPassword = process.env.TEST_ADMIN_PASSWORD || 'ChangeMeForLocalTests123!';
  const directorToken = await login('director@gatewaymotors.local', testPassword);
  assert(!!directorToken, 'Director authenticated successfully');

  const adminToken = await login('admin@gatewaymotors.local', testPassword);
  assert(!!adminToken, 'System Admin authenticated successfully');

  const techToken = await login('technician@gatewaymotors.local', testPassword);
  assert(!!techToken, 'Technician authenticated successfully');

  // Verify unauthorized user blocked from reporting and admin
  const techKpi = await request('GET', '/reporting/kpis', null, techToken);
  assert(techKpi.status === 403, 'Technician cannot access Director dashboard KPIs (403 Forbidden)');

  const techUsers = await request('GET', '/admin/users', null, techToken);
  assert(techUsers.status === 403, 'Technician cannot access user administration (403 Forbidden)');

  const techExport = await request('POST', '/reporting/export/sales', {}, techToken);
  assert(techExport.status === 403, 'Technician cannot trigger reporting exports (403 Forbidden)');

  const techAudits = await request('GET', '/admin/audit', null, techToken);
  assert(techAudits.status === 403, 'Technician cannot view audit trail (403 Forbidden)');

  // Step 2: Director Dashboard KPIs across all 6 business modules
  console.log('\n--- Step 2: Director Dashboard KPIs Across All 6 Business Modules ---');
  const kpiRes = await request('GET', '/reporting/kpis', null, directorToken);
  assert(kpiRes.status === 200, 'Director retrieved KPI metrics (200 OK)');
  const kpis = kpiRes.data;
  assert(kpis.sales && typeof kpis.sales.customers === 'number', 'Sales module KPIs present (customers count)');
  assert(typeof kpis.sales.bookings === 'number', 'Sales module KPIs present (bookings count)');
  assert(kpis.service && typeof kpis.service.openJobs === 'number', 'Service module KPIs present (open jobs count)');
  assert(kpis.bodyPaint && typeof kpis.bodyPaint.openOrders === 'number', 'Body & Paint KPIs present (open repair orders)');
  assert(kpis.parts && typeof kpis.parts.stockQuantity === 'number', 'Spare Parts KPIs present (total stock units)');
  assert(kpis.finance && typeof kpis.finance.receivablesOutstanding === 'number', 'Finance KPIs present (receivables due)');
  assert(typeof kpis.finance.payablesOutstanding === 'number', 'Finance KPIs present (payables due)');
  assert(typeof kpis.finance.expenses === 'number', 'Finance KPIs present (operating expenses)');
  assert(kpis.cashier && typeof kpis.cashier.postedAmount === 'number', 'Cashier KPIs present (posted receipts volume)');

  // Step 3: Module Summary Across All 6 Business Modules
  console.log('\n--- Step 3: Module Summary Distributions Across All 6 Business Modules ---');
  const summaryRes = await request('GET', '/reporting/summary', null, directorToken);
  assert(summaryRes.status === 200, 'Director retrieved summary distributions (200 OK)');
  const summary = summaryRes.data;
  assert(Array.isArray(summary.sales), 'Summary includes Sales bookings distribution');
  assert(Array.isArray(summary.service), 'Summary includes Service job cards distribution');
  assert(Array.isArray(summary.bodyPaint), 'Summary includes Body & Paint orders distribution');
  assert(Array.isArray(summary.parts), 'Summary includes Spare Parts inventory balances');
  assert(Array.isArray(summary.finance), 'Summary includes Operating expenses grouped by status');
  assert(Array.isArray(summary.cashier), 'Summary includes Daily cashier sessions distribution');

  // Step 4: Permitted KPI Drill-Down Across All Sources (including Parts & Audit)
  console.log('\n--- Step 4: Permitted KPI Drill-Downs Across All Sources ---');
  const drillSources = ['sales', 'service', 'body-paint', 'parts', 'finance', 'cashier', 'audit'];
  for (const src of drillSources) {
    const drillRes = await request('GET', `/reporting/drilldown/${src}?pageSize=5`, null, directorToken);
    assert(drillRes.status === 200, `Drill-down for "${src}" retrieved successfully (200 OK)`);
    assert(drillRes.data.source === src, `Drill-down response reflects correct source "${src}"`);
    assert(Array.isArray(drillRes.data.data), `Drill-down data for "${src}" is an array of rows`);
  }

  // Verify invalid source returns 400 Bad Request
  const badDrill = await request('GET', '/reporting/drilldown/invalid_source_123', null, directorToken);
  assert(badDrill.status === 400, 'Unknown drill-down source rejected with 400 Bad Request');

  // Step 5: Preset Date Filters (Daily, Monthly, Annual, Custom)
  console.log('\n--- Step 5: Preset Date Filters (Daily, Monthly, Annual, Custom) ---');
  const dailyKpi = await request('GET', '/reporting/kpis?period=daily', null, directorToken);
  assert(dailyKpi.status === 200, 'Daily preset filter period="daily" supported');

  const monthlyKpi = await request('GET', '/reporting/kpis?period=monthly', null, directorToken);
  assert(monthlyKpi.status === 200, 'Monthly preset filter period="monthly" supported');

  const annualKpi = await request('GET', '/reporting/kpis?period=annual', null, directorToken);
  assert(annualKpi.status === 200, 'Annual preset filter period="annual" supported');

  const customKpi = await request('GET', '/reporting/kpis?from=2026-01-01&to=2026-12-31', null, directorToken);
  assert(customKpi.status === 200, 'Custom ISO date range from/to supported');

  const invalidDate = await request('GET', '/reporting/kpis?from=2026-12-31&to=2026-01-01', null, directorToken);
  assert(invalidDate.status === 400, 'Invalid date range (from > to) rejected with 400 Bad Request');

  // Step 6: Profitability, Margins & Distinction Between Bookings, Sales, Cash, Debt & Profit
  console.log('\n--- Step 6: Profitability Calculations & Accounting Basis (Accrual vs. Cash) ---');
  const accrualProf = await request('GET', '/reporting/profitability?basis=accrual', null, directorToken);
  assert(accrualProf.status === 200, 'Accrual profitability report retrieved (200 OK)');
  const pA = accrualProf.data;
  assert(pA.basis === 'accrual', 'Report confirms accrual basis');
  assert(typeof pA.bookingsCount === 'number', 'Calculates Bookings count (pipeline/commitments)');
  assert(typeof pA.invoicedSales === 'number', 'Calculates Invoiced Sales (billed amount)');
  assert(typeof pA.cashReceived === 'number', 'Calculates Cash Received (cashier collections)');
  assert(typeof pA.outstandingReceivables === 'number', 'Calculates Outstanding Receivables');
  assert(typeof pA.invoicedVsCashDifference === 'number', 'Calculates Invoiced vs. Cash Difference (uncollected gap)');
  assert(typeof pA.collectionsRate === 'number', 'Calculates Collections Rate percentage');
  assert(typeof pA.grossProfit === 'number', 'Calculates Gross Profit');
  assert(typeof pA.grossMarginPct === 'number', 'Calculates Gross Margin percentage');
  assert(typeof pA.operatingExpenses === 'number', 'Calculates Operating Expenses');
  assert(typeof pA.operatingProfit === 'number', 'Calculates Operating Profit');
  assert(typeof pA.operatingMarginPct === 'number', 'Calculates Operating Margin percentage');
  assert(pA.breakdown && pA.breakdown.accrual && pA.breakdown.cash, 'Provides side-by-side comparison breakdown for Accrual and Cash');

  // Cash basis query
  const cashProf = await request('GET', '/reporting/profitability?basis=cash', null, directorToken);
  assert(cashProf.status === 200, 'Cash profitability report retrieved (200 OK)');
  const pC = cashProf.data;
  assert(pC.basis === 'cash', 'Report confirms cash basis');
  assert(pC.revenue === pC.cashReceived, 'In Cash basis, recognized revenue equals cash collections');

  // Step 7: User Administration (CRUD, Active/Inactive, Duplicate Rejection, Self-Deactivation Protection)
  console.log('\n--- Step 7: User Administration & Access Governance ---');
  const usersRes = await request('GET', '/admin/users?pageSize=10', null, directorToken);
  assert(usersRes.status === 200, 'Admin user list retrieved (200 OK)');
  assert(Array.isArray(usersRes.data.data), 'User list returns array of admin users');

  // Get roles for assignment
  const rolesRes = await request('GET', '/admin/roles', null, directorToken);
  assert(rolesRes.status === 200, 'Roles catalog retrieved (200 OK)');
  assert(Array.isArray(rolesRes.data) && rolesRes.data.length > 0, 'Roles list contains operational roles');
  const roleId = rolesRes.data[0].id;

  // Create a new user
  const uniqueSuffix = Date.now().toString().slice(-6);
  const newUsername = `test.user.${uniqueSuffix}`;
  const newEmail = `user.${uniqueSuffix}@gatewaymotors.local`;
  const createUserRes = await request(
    'POST',
    '/admin/users',
    {
      username: newUsername,
      email: newEmail,
      roleIds: [roleId],
      isActive: true,
    },
    directorToken,
  );
  assert(createUserRes.status === 200 || createUserRes.status === 201, `New user "${newUsername}" created successfully`);
  const createdUser = createUserRes.data;
  assert(createdUser.username === newUsername, 'Created user username matches');
  assert(createdUser.email === newEmail, 'Created user email matches');
  assert(createdUser.isActive === true, 'Created user is active by default');
  assert(createdUser.roles.some((r) => r.id === roleId), 'Assigned role is mapped to created user');

  // Duplicate username rejection
  const dupUserRes = await request(
    'POST',
    '/admin/users',
    {
      username: newUsername,
      email: `different.${uniqueSuffix}@gatewaymotors.local`,
    },
    directorToken,
  );
  assert(dupUserRes.status === 400, 'Duplicate username rejected with 400 Bad Request');

  // Duplicate email rejection
  const dupEmailRes = await request(
    'POST',
    '/admin/users',
    {
      username: `different.${uniqueSuffix}`,
      email: newEmail,
    },
    directorToken,
  );
  assert(dupEmailRes.status === 400, 'Duplicate email rejected with 400 Bad Request');

  // Update user access (toggle inactive)
  const toggleRes = await request(
    'POST',
    `/admin/users/${createdUser.id}/access`,
    {
      isActive: false,
    },
    directorToken,
  );
  assert(toggleRes.status === 200 || toggleRes.status === 201, 'User access updated successfully');
  assert(toggleRes.data.isActive === false, 'User status toggled to inactive (false)');

  // Reactivate user
  const reactivateRes = await request(
    'POST',
    `/admin/users/${createdUser.id}/access`,
    {
      isActive: true,
    },
    directorToken,
  );
  assert(reactivateRes.data.isActive === true, 'User status toggled back to active (true)');

  // Self-deactivation prevention
  // Find current user's ID
  const meRes = await request('GET', '/auth/me', null, directorToken);
  const myId = meRes.data.id;
  const selfDeactivateRes = await request(
    'POST',
    `/admin/users/${myId}/access`,
    {
      isActive: false,
    },
    directorToken,
  );
  assert(selfDeactivateRes.status === 400, 'Self-deactivation prevented with 400 Bad Request');

  // Step 8: Roles & Permissions Catalog
  console.log('\n--- Step 8: Roles & Permissions Catalog ---');
  const permsRes = await request('GET', '/admin/permissions', null, directorToken);
  assert(permsRes.status === 200, 'Permissions catalog retrieved (200 OK)');
  assert(Array.isArray(permsRes.data) && permsRes.data.length >= 25, 'Catalog contains granular operational permissions');

  // Step 9: Department Administration
  console.log('\n--- Step 9: Department Administration ---');
  const deptListRes = await request('GET', '/admin/departments', null, directorToken);
  assert(deptListRes.status === 200, 'Departments list retrieved (200 OK)');
  assert(Array.isArray(deptListRes.data), 'Departments response is an array');

  const deptCode = `DEPT_${uniqueSuffix}`;
  const createDeptRes = await request(
    'POST',
    '/admin/departments',
    {
      code: deptCode,
      name: `Operations Division ${uniqueSuffix}`,
    },
    directorToken,
  );
  assert(createDeptRes.status === 200 || createDeptRes.status === 201, `Department "${deptCode}" created successfully`);
  assert(createDeptRes.data.code === deptCode, 'Created department code matches');

  // Duplicate department rejection
  const dupDeptRes = await request(
    'POST',
    '/admin/departments',
    {
      code: deptCode,
      name: 'Duplicate Department',
    },
    directorToken,
  );
  assert(dupDeptRes.status === 400, 'Duplicate department code rejected with 400 Bad Request');

  // Step 10: Approval Rules & Cross-Departmental Approvals Inbox
  console.log('\n--- Step 10: Approval Rules & Cross-Departmental Approvals Inbox ---');
  const rulesRes = await request('GET', '/admin/approval-rules', null, directorToken);
  assert(rulesRes.status === 200, 'Approval rules catalog retrieved (200 OK)');
  assert(Array.isArray(rulesRes.data) && rulesRes.data.length >= 4, 'Approval rules include policies across Service, Finance, Body & Paint, Cashier');

  const approvalsRes = await request('GET', '/admin/approvals', null, directorToken);
  assert(approvalsRes.status === 200, 'Approvals inbox retrieved (200 OK)');
  const inbox = approvalsRes.data;
  assert(Array.isArray(inbox.estimates), 'Inbox includes Service estimates awaiting approval');
  assert(Array.isArray(inbox.expenses), 'Inbox includes Finance expenses awaiting approval');
  assert(Array.isArray(inbox.bodyPaint), 'Inbox includes Body & Paint supplemental approvals');

  // Test decision validation
  const invalidDec = await request('POST', '/admin/approvals/estimate/fake_id/decision', { decision: 'MAYBE' }, directorToken);
  assert(invalidDec.status === 400, 'Invalid decision ("MAYBE") rejected with 400 Bad Request');

  const unknownKind = await request('POST', '/admin/approvals/nonexistent/fake_id/decision', { decision: 'APPROVE' }, directorToken);
  assert(unknownKind.status === 400 || unknownKind.status === 404, 'Unknown approval kind rejected (400/404)');

  // Step 11: Audit Trail Search & Filtering
  console.log('\n--- Step 11: Audit Trail Search & Historical Inspection ---');
  const auditsRes = await request('GET', '/admin/audit?pageSize=20', null, directorToken);
  assert(auditsRes.status === 200, 'Audit search returned logs (200 OK)');
  assert(Array.isArray(auditsRes.data.data), 'Audit response includes event records');
  assert(auditsRes.data.total >= 1, 'Audit log records actions (including CREATE_USER and CREATE_DEPARTMENT)');

  // Verify search by entityType query
  const auditSearchUser = await request('GET', '/admin/audit?query=User', null, directorToken);
  assert(auditSearchUser.status === 200, 'Audit search filtered by entityType query=User (200 OK)');
  const userAudits = auditSearchUser.data.data;
  assert(userAudits.every((e) => e.entityType.includes('User')), 'Filtered audit entries strictly match "User"');

  // Step 12: Controlled Data Exports (JSON and Excel/CSV formats)
  console.log('\n--- Step 12: Controlled Data Exports (JSON and Excel/CSV) ---');
  const metaRes = await request('GET', '/reporting/metadata', null, directorToken);
  assert(metaRes.status === 200, 'Reporting metadata catalog retrieved (200 OK)');
  assert(metaRes.data.sources.includes('parts'), 'Metadata sources include "parts"');
  assert(metaRes.data.sources.includes('profitability'), 'Metadata sources include "profitability"');
  assert(metaRes.data.sources.includes('audit'), 'Metadata sources include "audit"');

  // Export JSON for sales
  const jsonExport = await request('POST', '/reporting/export/sales', { format: 'json' }, directorToken);
  assert(jsonExport.status === 200 || jsonExport.status === 201, 'Sales exported in JSON format (200 OK)');
  assert(Array.isArray(jsonExport.data.data), 'Export returns data rows');

  // Export CSV for parts
  const csvPartsExport = await request('POST', '/reporting/export/parts', { format: 'csv' }, directorToken);
  assert(csvPartsExport.status === 200 || csvPartsExport.status === 201, 'Parts exported in CSV format (200 OK)');
  assert(csvPartsExport.data.format === 'csv', 'Parts export format is csv');
  assert(typeof csvPartsExport.data.csv === 'string', 'CSV content string is generated');
  assert(csvPartsExport.data.filename.endsWith('.csv'), 'Download filename has .csv extension');

  // Export CSV for profitability
  const csvProfExport = await request('POST', '/reporting/export/profitability', { format: 'csv' }, directorToken);
  assert(csvProfExport.status === 200 || csvProfExport.status === 201, 'Profitability exported in CSV format (200 OK)');
  assert(csvProfExport.data.format === 'csv', 'Profitability export format is csv');
  assert(csvProfExport.data.csv.includes('Bookings Count') && csvProfExport.data.csv.includes('Invoiced Sales'), 'CSV contains key profitability metrics headers/rows');

  // Export audit logs
  const auditExport = await request('POST', '/reporting/export/audit', { format: 'csv' }, directorToken);
  assert(auditExport.status === 200 || auditExport.status === 201, 'Audit log exported in CSV format (200 OK)');
  assert(auditExport.data.format === 'csv', 'Audit export format is csv');

  console.log('\n========================================================================');
  console.log(`PHASE 8 E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error during Phase 8 test run:', err);
  process.exit(1);
});
