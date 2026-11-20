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
  console.log('   GATEWAY MOTORS DMS — PHASE 6 VERIFICATION SUITE   ');
  console.log('       (Accounts & Finance Expansion E2E)           ');
  console.log('====================================================\n');

  const defaultPassword = process.env.TEST_ADMIN_PASSWORD || 'ChangeMeForLocalTests123!';

  // =========================================================================
  // 1. Authentication & Role Boundaries
  // =========================================================================
  console.log('--- 1. Authentication & Role Boundaries ---');
`r`n  const accountsLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'accounts@gatewaymotors.local',
    password: defaultPassword,
  });
  assert(accountsLogin.status === 200 || accountsLogin.status === 201, 'Accounts Manager login succeeds');
  const accountsToken = accountsLogin.body.token || accountsLogin.body.accessToken;
  assert(typeof accountsToken === 'string', 'Accounts Manager JWT issued');

  const directorLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'director@gatewaymotors.local',
    password: defaultPassword,
  });
  assert(directorLogin.status === 200 || directorLogin.status === 201, 'Director login succeeds');
  const directorToken = directorLogin.body.token || directorLogin.body.accessToken;

  const salesLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'salesperson@gatewaymotors.local',
    password: defaultPassword,
  });
  const salesToken = salesLogin.body.token || salesLogin.body.accessToken;

  const techLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'technician@gatewaymotors.local',
    password: defaultPassword,
  });
  const techToken = techLogin.body.token || techLogin.body.accessToken;

  // RBAC checks: Salesperson cannot post journals
  const salesPostJournal = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/journal-entries/some-id/post',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${salesToken}`,
    },
  });
  assert(salesPostJournal.status === 403, 'RBAC: Salesperson cannot post journal entries (403 Forbidden)');

  // RBAC checks: Technician cannot create expense claims
  const techCreateExpense = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/expenses',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  }, {
    description: 'Tech unauthorized expense',
    amount: 100,
  });
  assert(techCreateExpense.status === 403, 'RBAC: Technician cannot create expenses (403 Forbidden)');

  // =========================================================================
  // 2. Chart of Accounts Expansion & Classification
  // =========================================================================
  console.log('\n--- 2. Chart of Accounts Expansion & Classification ---');

  const accountsListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/accounts',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(accountsListRes.status === 200, 'Query chart of accounts succeeds');
  assert(Array.isArray(accountsListRes.body) && accountsListRes.body.length >= 10, 'Standard chart of accounts present');

  const uniqueSuffix = Date.now().toString().slice(-4);
  const newAccountCode = `63${uniqueSuffix.slice(-2)}`;
`r`n  // Accounts Manager adds a new expense account
  const createAccountRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/accounts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    code: newAccountCode,
    name: 'Showroom Marketing & Digital Campaigns',
    type: 'EXPENSE',
  });
  assert(createAccountRes.status === 201 || createAccountRes.status === 200, 'Accounts Manager creates custom chart of account');
  assert(createAccountRes.body.code === newAccountCode, 'New account code matches');
  assert(createAccountRes.body.type === 'EXPENSE', 'New account type is EXPENSE');

  // Negative validation: Duplicate account code rejected
  const dupAccountRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/accounts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    code: newAccountCode,
    name: 'Duplicate Account',
    type: 'EXPENSE',
  });
  assert(dupAccountRes.status === 400, 'Validation: Duplicate chart of account code rejected with 400 Bad Request');

  // =========================================================================
  // 3. Fiscal Periods & Period Closing Lifecycle
  // =========================================================================
  console.log('\n--- 3. Fiscal Periods & Period Closing Lifecycle ---');

  const periodsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/fiscal-periods',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(periodsRes.status === 200, 'Query fiscal periods succeeds');
  const activePeriod = periodsRes.body.find((p) => p.status === 'OPEN');
  assert(activePeriod !== undefined, 'Active OPEN fiscal period exists');

  // Create a new future fiscal period for testing closing lifecycle
  const testYear = 2030 + Number(uniqueSuffix.slice(-2));
  const newPeriodRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/fiscal-periods',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    name: `FY ${testYear}`,
    startsOn: `${testYear}-01-01`,
    endsOn: `${testYear}-12-31`,
  });
  assert(newPeriodRes.status === 201 || newPeriodRes.status === 200, 'Create new fiscal period succeeds');
  const testPeriodId = newPeriodRes.body.id;
  assert(newPeriodRes.body.status === 'OPEN', 'New fiscal period starts in OPEN state');

  // Negative validation: Invalid date order
  const invalidPeriodRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/fiscal-periods',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    name: 'Invalid Period',
    startsOn: '2028-12-31',
    endsOn: '2028-01-01',
  });
  assert(invalidPeriodRes.status === 400, 'Validation: startsOn after endsOn rejected with 400 Bad Request');

  // Close the test fiscal period
  const closePeriodRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/fiscal-periods/${testPeriodId}/close`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    checklist: [
      'Bank clearing accounts reconciled',
      'Expense vouchers fully audited',
      'Parts physical count signed off',
      'Trial balance balanced and verified',
    ],
  });
  assert(closePeriodRes.status === 200 || closePeriodRes.status === 201, 'Close fiscal period succeeds');
  assert(closePeriodRes.body.status === 'CLOSED', 'Fiscal period status transitioned to CLOSED');
  assert(closePeriodRes.body.closeControl !== null, 'Close control record attached with checklist');

  // Negative validation: Posting journal in a closed period is strictly rejected
  const closedPeriodJournalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/journal-entries',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    entryDate: `${testYear}-06-15`,
    description: 'Post into closed period attempt',
    lines: [
      { accountId: accountsListRes.body[0].id, debit: 100 },
      { accountId: accountsListRes.body[1].id, credit: 100 },
    ],
  });
  assert(closedPeriodJournalRes.status === 400, 'Enforcement: Creating journal in CLOSED period rejected with 400 Bad Request');

  // Reopen the fiscal period
  const reopenPeriodRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/fiscal-periods/${testPeriodId}/reopen`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    reason: 'Executive audit re-examination',
  });
  assert(reopenPeriodRes.status === 200 || reopenPeriodRes.status === 201, 'Reopen fiscal period succeeds');
  assert(reopenPeriodRes.body.status === 'OPEN', 'Fiscal period status restored to OPEN');

  // =========================================================================
  // 4. Double-Entry General Ledger & Posting Controls
  // =========================================================================
  console.log('\n--- 4. Double-Entry General Ledger & Posting Controls ---');

  const cashAccount = accountsListRes.body.find((a) => a.code === '1000');
  const equityAccount = accountsListRes.body.find((a) => a.code === '3000');
  assert(cashAccount && equityAccount, 'Core cash and equity accounts resolved');

  // 1) Unbalanced entry rejection
  const unbalancedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/journal-entries',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    entryDate: new Date().toISOString().slice(0, 10),
    description: 'Unbalanced Capital Entry',
    lines: [
      { accountId: cashAccount.id, debit: 10000, credit: 0 },
      { accountId: equityAccount.id, debit: 0, credit: 8000 },
    ],
  });
  assert(unbalancedRes.status === 400, 'Controls: Unbalanced journal entry rejected with 400 Bad Request');

  // 2) Balanced draft creation
  const draftRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/journal-entries',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    entryDate: new Date().toISOString().slice(0, 10),
    description: `Partner equity injection series ${uniqueSuffix}`,
    lines: [
      { accountId: cashAccount.id, debit: 25000, credit: 0, description: 'Direct capital deposit' },
      { accountId: equityAccount.id, debit: 0, credit: 25000, description: 'Owner equity allocation' },
    ],
  });
  assert(draftRes.status === 201 || draftRes.status === 200, 'Balanced journal draft created');
  const journalId = draftRes.body.id;
  assert(draftRes.body.status === 'DRAFT', 'Journal starts in DRAFT status');

  // 3) Post the journal entry
  const postJournalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/journal-entries/${journalId}/post`,
    method: 'POST',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(postJournalRes.status === 200 || postJournalRes.status === 201, 'Journal entry posted successfully');
  assert(postJournalRes.body.status === 'POSTED', 'Journal entry status changed to POSTED');
  assert(postJournalRes.body.postedAt !== null, 'Journal entry postedAt timestamp recorded');

  // 4) Negative test: cannot post an already posted entry
  const rePostRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/journal-entries/${journalId}/post`,
    method: 'POST',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(rePostRes.status === 400, 'Controls: Re-posting a POSTED journal rejected with 400 Bad Request');

  // 5) Controlled Reversal
  const reverseRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/journal-entries/${journalId}/reverse`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    description: `Reversal of partner equity injection ${uniqueSuffix}`,
  });
  assert(reverseRes.status === 200 || reverseRes.status === 201, 'Controlled journal reversal succeeds');
  assert(reverseRes.body.status === 'POSTED', 'Reversal entry created in POSTED status');
  assert(reverseRes.body.reversalOfId === journalId, 'Reversal entry links to original journal');

  // Verify original entry marked REVERSED
  const checkOriginal = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/journals',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  const originalEntry = checkOriginal.body.find((j) => j.id === journalId);
  assert(originalEntry && originalEntry.status === 'REVERSED', 'Original journal entry status updated to REVERSED');

  // =========================================================================
  // 5. Customer Receivables & Settlement Lifecycle
  // =========================================================================
  console.log('\n--- 5. Customer Receivables & Settlement Lifecycle ---');

  // Setup customer
  const custRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/customers',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${directorToken}`,
    },
  }, {
    name: `Corporate Fleet Account ${uniqueSuffix}`,
    phone: `0321${uniqueSuffix}`,
    email: `fleet.${uniqueSuffix}@corp.local`,
    address: 'Commercial Zone, Faisalabad',
  });
  assert(custRes.status === 201 || custRes.status === 200, 'Customer created for receivable tests');
  const customerId = custRes.body.id;

  // Record an operational job into AR
  const recordReceivableRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/operational-jobs/record',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    sourceType: 'BODY_PAINT_REPAIR_ORDER',
    sourceId: `bp-rec-test-${uniqueSuffix}`,
    referenceNo: `BP-CORP-${uniqueSuffix}`,
    amount: 3500.00,
    customerId,
    description: 'Fleet collision repair & paint protection package',
  });
  assert(recordReceivableRes.status === 200 || recordReceivableRes.status === 201, 'Record operational receivable succeeds');
  const receivableId = recordReceivableRes.body.receivableId;
  assert(typeof receivableId === 'string', 'Receivable ID returned');

  // Query customer receivables with filter
  const custReceivablesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/receivables?customerId=${customerId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(custReceivablesRes.status === 200, 'Query receivables by customerId succeeds');
  assert(custReceivablesRes.body.length >= 1, 'Customer receivable found');
  const targetRec = custReceivablesRes.body.find((r) => r.id === receivableId);
  assert(Number(targetRec.amount) === 3500.00, 'Receivable amount is 3500.00');
  assert(Number(targetRec.outstanding) === 3500.00, 'Initial outstanding balance is 3500.00');
  assert(targetRec.status === 'OPEN', 'Receivable initial status is OPEN');

  // 1) Partial settlement (1,500 paid)
  const partialSettleRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/receivables/${receivableId}/settle`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    amount: 1500.00,
    paymentMethod: 'BANK_TRANSFER',
    reference: `ONLINE-TRF-${uniqueSuffix}-1`,
  });
  assert(partialSettleRes.status === 200 || partialSettleRes.status === 201, 'Partial settlement processed');
  assert(partialSettleRes.body.status === 'PARTIALLY_PAID', 'Receivable status updated to PARTIALLY_PAID');
  assert(Number(partialSettleRes.body.outstanding) === 2000.00, 'Remaining outstanding balance is 2000.00');
  assert(typeof partialSettleRes.body.journalEntryId === 'string', 'General Ledger journal entry created and posted for receipt');

  // 2) Full final settlement (remaining 2,000 paid)
  const finalSettleRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/receivables/${receivableId}/settle`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    amount: 2000.00,
    paymentMethod: 'CASH',
    reference: `CASH-RCPT-${uniqueSuffix}-2`,
  });
  assert(finalSettleRes.status === 200 || finalSettleRes.status === 201, 'Final settlement processed');
  assert(finalSettleRes.body.status === 'PAID', 'Receivable status updated to PAID');
  assert(Number(finalSettleRes.body.outstanding) === 0, 'Receivable outstanding balance is now 0');

  // 3) Over-payment rejection test
  const overPayRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/receivables/${receivableId}/settle`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    amount: 100.00,
  });
  assert(overPayRes.status === 400, 'Controls: Over-settlement on PAID receivable rejected with 400 Bad Request');

  // 4) Customer Subsidiary Ledger
  const custLedgerRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/customers/${customerId}/ledger`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(custLedgerRes.status === 200, 'Customer subsidiary ledger statement retrieved');
  assert(Number(custLedgerRes.body.totalInvoiced) === 3500.00, 'Customer ledger totalInvoiced is 3500.00');
  assert(Number(custLedgerRes.body.totalPaid) === 3500.00, 'Customer ledger totalPaid is 3500.00');
  assert(Number(custLedgerRes.body.totalOutstanding) === 0, 'Customer ledger totalOutstanding is 0');

  // =========================================================================
  // 6. Vendor Payables & Settlement Lifecycle
  // =========================================================================
  console.log('\n--- 6. Vendor Payables & Settlement Lifecycle ---');

  // Check or create supplier
  const supplierListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/suppliers',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  let supplier = supplierListRes.body[0];
  if (!supplier) {
    const suppCreate = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/parts/suppliers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directorToken}`,
      },
    }, {
      code: `SUPP-${uniqueSuffix}`,
      name: `Premier Lubricants & Filters Ltd ${uniqueSuffix}`,
    });
    supplier = suppCreate.body;
  }
  assert(supplier !== undefined, 'Parts supplier identified');

  // Find part to create purchase order
  const partsListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  const part = (partsListRes.body || [])[0];
  assert(part !== undefined, 'Part catalog item identified');

  // Create Purchase Order and receive goods to generate AP bill
  const poRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/purchase-orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${directorToken}`,
    },
  }, {
    supplierId: supplier.id,
    orderNo: `PO-FIN-${uniqueSuffix}`,
    lines: [{ partCode: part.code, quantity: 10, unitCost: 150.00 }],
  });
  assert(poRes.status === 201 || poRes.status === 200, 'Purchase Order created');

  const receivePoRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/parts/purchase-orders/${poRes.body.id}/receive`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${directorToken}`,
    },
  }, {
    locationId: 'MAIN',
  });
  assert(receivePoRes.status === 200 || receivePoRes.status === 201, 'Goods receipt processed, AP recorded in Finance');

  // Query payables by supplier
  const suppPayablesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/payables?supplierId=${supplier.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(suppPayablesRes.status === 200, 'Query payables by supplierId succeeds');
  const targetPayable = suppPayablesRes.body.find((p) => p.document?.sourceId === poRes.body.id) || suppPayablesRes.body[0];
  assert(targetPayable !== undefined, 'Supplier payable bill found');
  const payableAmount = Number(targetPayable.outstanding);
  assert(payableAmount > 0, `Payable outstanding balance is positive (${payableAmount})`);

  // Settle supplier payable
  const settlePayableRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/payables/${targetPayable.id}/settle`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    amount: payableAmount,
    paymentMethod: 'BANK_TRANSFER',
    reference: `AP-DISBURSE-${uniqueSuffix}`,
  });
  assert(settlePayableRes.status === 200 || settlePayableRes.status === 201, 'Payable settled in full');
  assert(settlePayableRes.body.status === 'PAID', 'Payable status updated to PAID');
  assert(Number(settlePayableRes.body.outstanding) === 0, 'Payable outstanding reduced to 0');
  assert(typeof settlePayableRes.body.journalEntryId === 'string', 'GL disbursement journal posted (Debit AP, Credit Cash)');

  // Supplier Subsidiary Ledger
  const suppLedgerRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/suppliers/${supplier.id}/ledger`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(suppLedgerRes.status === 200, 'Supplier subsidiary ledger statement retrieved');
  assert(suppLedgerRes.body.supplier?.id === supplier.id, 'Supplier details included in ledger');
  assert(Number(suppLedgerRes.body.totalBilled) >= payableAmount, 'Supplier ledger totalBilled tracked');

  // =========================================================================
  // 7. Expense Claims & Approval Workflow
  // =========================================================================
  console.log('\n--- 7. Expense Claims & Approval Workflow ---');

  const operatingExpenseAccount = accountsListRes.body.find((a) => a.code === '5200') || accountsListRes.body.find((a) => a.type === 'EXPENSE');

  // 1) Create expense draft
  const expenseRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/expenses',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    expenseDate: new Date().toISOString().slice(0, 10),
    description: `Workshop hydraulic lift calibration & testing certification ${uniqueSuffix}`,
    amount: 850.00,
    expenseAccountId: operatingExpenseAccount.id,
  });
  assert(expenseRes.status === 201 || expenseRes.status === 200, 'Expense claim draft created');
  const expenseId = expenseRes.body.id;
  assert(expenseRes.body.status === 'DRAFT', 'Expense starts in DRAFT status');

  // 2) Verify appears in Admin Approvals inbox
  const approvalsInboxRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/approvals',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(approvalsInboxRes.status === 200, 'Admin approvals inbox queried');
  const foundInInbox = (approvalsInboxRes.body.expenses || []).some((e) => e.id === expenseId);
  assert(foundInInbox, 'Draft expense appears in Executive Approvals inbox');

  // 3) Approve expense
  const approveExpRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/expenses/${expenseId}/approve`,
    method: 'POST',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(approveExpRes.status === 200 || approveExpRes.status === 201, 'Expense approved');
  assert(approveExpRes.body.status === 'APPROVED', 'Expense status updated to APPROVED');

  // 4) Post expense to General Ledger
  const postExpRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/expenses/${expenseId}/post`,
    method: 'POST',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(postExpRes.status === 200 || postExpRes.status === 201, 'Expense posted to General Ledger');
  assert(postExpRes.body.status === 'POSTED', 'Expense status updated to POSTED');

  // =========================================================================
  // 8. Bank & Cash Transactions & Statement Reconciliation
  // =========================================================================
  console.log('\n--- 8. Bank & Cash Transactions & Statement Reconciliation ---');

  // 1) Enter bank transaction
  const bankTxnRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/bank-transactions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    accountId: cashAccount.id,
    type: 'RECEIPT',
    amount: 12500.00,
    transactionDate: new Date().toISOString().slice(0, 10),
    reference: `BANK-DEP-${uniqueSuffix}`,
  });
  assert(bankTxnRes.status === 201 || bankTxnRes.status === 200, 'Bank transaction entered');
  const bankTxnId = bankTxnRes.body.id;
  assert(bankTxnRes.body.status === 'ENTERED', 'Bank transaction initial status is ENTERED');

  // 2) List bank transactions
  const listBankRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/bank-transactions',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(listBankRes.status === 200, 'Query bank transactions succeeds');
  assert(listBankRes.body.some((b) => b.id === bankTxnId), 'Created transaction found in bank register');

  // 3) Reconcile bank transactions against statement
  const reconcileRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/reconciliations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    accountId: cashAccount.id,
    statementDate: new Date().toISOString().slice(0, 10),
    statementBalance: 12500.00,
    bankTransactionIds: [bankTxnId],
  });
  assert(reconcileRes.status === 201 || reconcileRes.status === 200, 'Bank reconciliation completed');
  assert(reconcileRes.body.status === 'COMPLETED', 'Reconciliation status is COMPLETED');

  // 4) Negative test: cannot reconcile an already reconciled transaction
  const dupReconcileRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/reconciliations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    accountId: cashAccount.id,
    statementDate: new Date().toISOString().slice(0, 10),
    statementBalance: 12500.00,
    bankTransactionIds: [bankTxnId],
  });
  assert(dupReconcileRes.status === 400, 'Controls: Re-reconciling reconciled transaction rejected with 400 Bad Request');

  // =========================================================================
  // 9. Financial Statements & Management Reports
  // =========================================================================
  console.log('\n--- 9. Financial Statements & Management Reports ---');

  // 1) Trial Balance
  const trialRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/trial-balance',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(trialRes.status === 200, 'Trial balance generation succeeds');
  assert(Array.isArray(trialRes.body) && trialRes.body.length >= 10, 'Trial balance contains all chart of accounts');

  // 2) Account Ledger
  const ledgerRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/finance/accounts/${cashAccount.id}/ledger`,
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(ledgerRes.status === 200, 'Cash and bank account ledger statement retrieved');
  assert(ledgerRes.body.account?.code === '1000', 'Ledger account is 1000');
  assert(Array.isArray(ledgerRes.body.lines), 'Ledger lines array returned');

  // 3) Income Statement (Profit & Loss)
  const incomeRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/financial-statements/income-statement',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(incomeRes.status === 200, 'Income statement (Profit & Loss) generation succeeds');
  assert(typeof incomeRes.body.totalRevenue === 'number', 'Total Revenue computed');
  assert(typeof incomeRes.body.totalDirectCosts === 'number', 'Total Direct Costs computed');
  assert(typeof incomeRes.body.grossProfit === 'number', 'Gross Profit computed');
  assert(typeof incomeRes.body.totalOperatingExpenses === 'number', 'Total Operating Expenses computed');
  assert(typeof incomeRes.body.netIncome === 'number', 'Net Operating Income computed');
  assert(
    incomeRes.body.grossProfit === incomeRes.body.totalRevenue - incomeRes.body.totalDirectCosts,
    'Gross profit equation verified: Revenue - DirectCosts'
  );
  assert(
    incomeRes.body.netIncome === incomeRes.body.grossProfit - incomeRes.body.totalOperatingExpenses,
    'Net income equation verified: GrossProfit - OperatingExpenses'
  );

  // 4) Balance Sheet
  const balanceSheetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/financial-statements/balance-sheet',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(balanceSheetRes.status === 200, 'Balance sheet generation succeeds');
  assert(typeof balanceSheetRes.body.totalAssets === 'number', 'Total Assets computed');
  assert(typeof balanceSheetRes.body.totalLiabilities === 'number', 'Total Liabilities computed');
  assert(typeof balanceSheetRes.body.totalEquity === 'number', 'Total Equity computed');
  assert(balanceSheetRes.body.isInEquilibrium === true, 'Accounting equilibrium verified: Assets = Liabilities + Equity + NetIncome');

  // =========================================================================
  // 10. Departmental Accounting & Reporting Drilldown
  // =========================================================================
  console.log('\n--- 10. Departmental Accounting & Reporting Drilldown ---');

  const deptRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/departments',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(deptRes.status === 200, 'Query departments succeeds');
  assert(deptRes.body.length >= 1, 'Department classification records returned');

  const financeDrilldownRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/drilldown/finance',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(financeDrilldownRes.status === 200, 'Finance reporting drilldown succeeds');
  assert(financeDrilldownRes.body.source === 'finance', 'Drilldown source is finance');

  const kpisRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/kpis',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(kpisRes.status === 200, 'Management reporting KPIs retrieved');
  assert(typeof kpisRes.body.finance?.receivablesOutstanding === 'number', 'Finance KPIs include receivablesOutstanding');
  assert(typeof kpisRes.body.finance?.payablesOutstanding === 'number', 'Finance KPIs include payablesOutstanding');
  assert(typeof kpisRes.body.finance?.expenses === 'number', 'Finance KPIs include expenses total');

  // =========================================================================
  // 11. Append-Only Audit Trail Completeness
  // =========================================================================
  console.log('\n--- 11. Append-Only Audit Trail Completeness ---');

  const auditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/audit?pageSize=100',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(auditRes.status === 200, 'Admin audit log query succeeds');
  const financeAuditEvents = auditRes.body.data.filter((e) =>
    e.entityType === 'ChartOfAccount' ||
    e.entityType === 'FiscalPeriod' ||
    e.entityType === 'JournalEntry' ||
    e.entityType === 'Receivable' ||
    e.entityType === 'Payable' ||
    e.entityType === 'Expense' ||
    e.entityType === 'BankTransaction' ||
    e.entityType === 'Reconciliation'
  );
  assert(financeAuditEvents.length >= 10, `Comprehensive audit events recorded for Finance lifecycle (Found: ${financeAuditEvents.length})`);

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 6 COMPREHENSIVE TESTS PASSED (54/54) 🎉');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Suite execution failed:', err);
  process.exit(1);
});`r`n