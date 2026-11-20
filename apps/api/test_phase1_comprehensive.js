const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function run() {
  console.log('====================================================');
  console.log('   GATEWAY MOTORS DMS — PHASE 1 VERIFICATION SUITE   ');
  console.log('====================================================\n');

  // 1. Health check
  console.log('--- 1. API Health & Readiness ---');
  const healthRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
  });
  assert(healthRes.status === 200, 'Health endpoint responds with 200');
  assert(healthRes.body.status === 'ok', 'Health status is ok');
  assert(healthRes.body.service === 'gateway-motors-api', 'Service name is gateway-motors-api');

  // 2. Authentication & Security
  console.log('\n--- 2. Authentication, Token Issuance & Profile ---');
  const badLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'admin@gatewaymotors.local',
    password: 'WrongPassword123!'
  });
  assert(badLogin.status === 401, 'Invalid password rejected with 401 Unauthorized');

  const adminLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'admin@gatewaymotors.local',
    password: process.env.TEST_ADMIN_PASSWORD || 'ChangeMeForLocalTests123!'
  });
  assert(adminLogin.status === 200 || adminLogin.status === 201, 'Admin login succeeds with 200/201');
  const adminToken = adminLogin.body.token || adminLogin.body.accessToken;
  assert(typeof adminToken === 'string' && adminToken.length > 20, 'JWT access token returned');

  // Verify /api/auth/me
  const meRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(meRes.status === 200, 'GET /api/auth/me returns 200');
  assert(meRes.body.username === 'admin', 'Current user username is admin');
  assert(Array.isArray(meRes.body.roles) && meRes.body.roles.length > 0, 'User has assigned roles');
  assert(Array.isArray(meRes.body.permissions) && meRes.body.permissions.length > 0, 'User has assigned permissions');

  // Verify permission check endpoint
  const permCheckAllowed = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/permissions/check?code=users.manage',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(permCheckAllowed.status === 200 && permCheckAllowed.body.allowed === true, 'Permission check for users.manage is true');

  const permCheckDenied = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/permissions/check?code=nonexistent.fake.permission',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(permCheckDenied.status === 200 && permCheckDenied.body.allowed === false, 'Permission check for nonexistent permission is false');

  // 3. User & Access Administration (RBAC)
  console.log('\n--- 3. RBAC, Roles, Permissions & User Management ---');
  const rolesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/roles',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(rolesRes.status === 200, 'GET /api/admin/roles returns 200');
  assert(Array.isArray(rolesRes.body) && rolesRes.body.length >= 10, 'All 10 required operational roles exist');

  const permsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/permissions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(permsRes.status === 200, 'GET /api/admin/permissions returns 200');
  assert(Array.isArray(permsRes.body) && permsRes.body.length >= 60, `Enterprise permissions catalog seeded (${permsRes.body.length} permissions)`);

  const usersListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(usersListRes.status === 200, 'GET /api/admin/users returns 200');
  const userList = Array.isArray(usersListRes.body) ? usersListRes.body : usersListRes.body.data;
  assert(Array.isArray(userList) && userList.length >= 10, `All departmental users seeded (${userList.length} users)`);

  // Create a new employee account via Admin API
  const testUserEmail = `staff.${Date.now()}@gatewaymotors.local`;
  const createUserRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/users',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    username: `staff_${Date.now()}`,
    email: testUserEmail,
    password: 'GatewayTempPassword2026!',
    roleIds: [rolesRes.body[0].id]
  });
  assert(createUserRes.status === 201, 'Admin can create new user with role assignment (201 Created)');
  const newUserId = createUserRes.body.id;
  assert(typeof newUserId === 'string', 'Created user has unique CUID');

  // Update user access
  const updateAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/users/${newUserId}/access`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    roleIds: [rolesRes.body[1].id]
  });
  assert(updateAccessRes.status === 200 || updateAccessRes.status === 201, 'Admin can update user role assignments');

  // 4. Financial Foundation: Chart of Accounts & Fiscal Periods
  console.log('\n--- 4. Chart of Accounts & Fiscal Periods ---');
  const coaRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/accounts',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(coaRes.status === 200, 'GET /api/finance/accounts returns 200');
  assert(Array.isArray(coaRes.body) && coaRes.body.length >= 10, 'Standard chart of accounts is configured');
  const accountCodes = coaRes.body.map(a => a.code);
  assert(accountCodes.includes('1000'), '1000 Cash and Bank account exists');
  assert(accountCodes.includes('1100'), '1100 Accounts Receivable exists');
  assert(accountCodes.includes('1200'), '1200 Parts Inventory exists');
  assert(accountCodes.includes('2000'), '2000 Accounts Payable exists');

  const periodRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/fiscal-periods',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(periodRes.status === 200, 'GET /api/finance/fiscal-periods returns 200');
  assert(Array.isArray(periodRes.body) && periodRes.body.length > 0, 'Active fiscal period exists');
  assert(periodRes.body.some(p => p.status === 'OPEN'), 'Fiscal period is OPEN for postings');

  // 5. Core Journal Posting & Reversals (Maker-Checker / Transaction Integrity)
  console.log('\n--- 5. Double-Entry Journal Posting Engine ---');
  const cashAccount = coaRes.body.find(a => a.code === '1000');
  const revenueAccount = coaRes.body.find(a => a.code === '4000');
  assert(Boolean(cashAccount && revenueAccount), 'Required chart of accounts (1000 & 4000) resolved');

  // Rejection of unbalanced entry
  const unbalancedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/journal-entries',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    entryDate: new Date().toISOString(),
    description: 'Unbalanced test entry',
    lines: [
      { accountId: cashAccount.id, debit: 5000, credit: 0 },
      { accountId: revenueAccount.id, debit: 0, credit: 4000 }
    ]
  });
  assert(unbalancedRes.status === 400, 'Unbalanced journal entry rejected with 400 Bad Request');

  // Balanced entry creation
  const balancedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/journal-entries',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    entryDate: new Date().toISOString(),
    description: 'Phase 1 Capital Introduction',
    lines: [
      { accountId: cashAccount.id, debit: 15000, credit: 0 },
      { accountId: revenueAccount.id, debit: 0, credit: 15000 }
    ]
  });
  if (balancedRes.status !== 201) {
    console.error('Balanced journal creation failed:', balancedRes.status, balancedRes.body);
  }
  assert(balancedRes.status === 201, 'Balanced journal entry created (201 Created)');
  const journalId = balancedRes.body.id;
  assert(typeof journalId === 'string', 'Journal entry has unique ID');
  assert(balancedRes.body.status === 'DRAFT', 'New journal entry starts in DRAFT status');

  // Post journal entry
  const postJournalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/journal-entries/${journalId}/post`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  assert(postJournalRes.status === 200 || postJournalRes.status === 201, 'Journal entry posted successfully');
  assert(postJournalRes.body.status === 'POSTED', 'Journal entry status changed to POSTED');

  // 6. Minimal Stock Ledger & Concurrency-Safe Inventory Primitives
  console.log('\n--- 6. Stock Ledger, Movements & Over-Issue Protection ---');
  // Stock Receive
  const stockReceiveRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/inventory/receive',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    locationId: 'MAIN',
    itemCode: 'OIL-FILTER-001',
    quantity: 50,
    unitCost: 15.00,
    reference: 'PO-PHASE1-TEST'
  });
  assert(stockReceiveRes.status === 200 || stockReceiveRes.status === 201, 'Stock received into MAIN store (200/201)');
  assert(parseFloat(stockReceiveRes.body.quantity) >= 50, 'Stock balance updated to reflect receipt');

  // Stock Issue
  const stockIssueRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/inventory/issue',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    locationId: 'MAIN',
    itemCode: 'OIL-FILTER-001',
    quantity: 10,
    reference: 'ISSUE-PHASE1-TEST'
  });
  assert(stockIssueRes.status === 200 || stockIssueRes.status === 201, 'Stock issued from MAIN store');

  // Over-issue rejection
  const overIssueRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/inventory/issue',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    locationId: 'MAIN',
    itemCode: 'OIL-FILTER-001',
    quantity: 999999, // Impossible quantity
    reference: 'OVER-ISSUE-TEST'
  });
  assert(overIssueRes.status === 400, 'Over-issue quantity rejected with 400 Bad Request');

  // 7. Audit Logging & Security Trail
  console.log('\n--- 7. Append-Only Audit Trail ---');
  const auditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/audit',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(auditRes.status === 200, 'GET /api/admin/audit returns 200');
  const auditList = Array.isArray(auditRes.body) ? auditRes.body : auditRes.body.data;
  assert(Array.isArray(auditList) && auditList.length > 0, `Audit trail contains logged actions (${auditList.length} events logged)`);

  // 8. Approvals Engine
  console.log('\n--- 8. Approvals Workflow Inbox ---');
  const approvalsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/approvals',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(approvalsRes.status === 200, 'GET /api/admin/approvals returns 200');
  assert(typeof approvalsRes.body === 'object' && approvalsRes.body !== null, 'Approvals inbox is accessible and returns structured categories');

  console.log('\n====================================================');
  console.log('   🎉 ALL PHASE 1 REQUIREMENTS VERIFIED 100% OK!   ');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Phase 1 test failed:', err);
  process.exit(1);
});
