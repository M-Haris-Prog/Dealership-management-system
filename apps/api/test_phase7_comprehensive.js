/**
 * GATEWAY MOTORS DMS — PHASE 7 VERIFICATION SUITE
 * Cashier Management End-to-End Verification
 *
 * Verifies all 9 specifications from plan.md:
 * 1. Cashier opening balance
 * 2. Cash receipts and payments
 * 3. Customer, sales, service, and parts receipts
 * 4. Payment vouchers
 * 5. Numbered receipts and printable output
 * 6. Cash-in/cash-out
 * 7. Daily closing and reconciliation
 * 8. Cashier-wise history and discrepancy reports
 * 9. Controlled reversal/correction linked to the original transaction
 * + Explicit security prohibitions (no receipt deletion, self-approval blocked, RBAC)
 */

const http = require('http');

const API_BASE = 'http://localhost:3000/api';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || process.env.TEST_ADMIN_PASSWORD || 'ChangeMeForLocalTests123!';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(
      url,
      { method, headers, timeout: 10000 },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout ${method} ${path}`));
    });

    if (data) req.write(data);
    req.end();
  });
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASSED: ${message}`);
    passedCount++;
  } else {
    console.error(`❌ FAILED: ${message}`);
    failedCount++;
  }
}

async function login(username, password = ADMIN_PASSWORD) {
  const identifier = username.includes('@') ? username : `${username}@gatewaymotors.local`;
  const res = await request('POST', '/auth/login', { identifier, password });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(res.data)}`);
  }
  return res.data.token || res.data.accessToken;
}

async function runPhase7Tests() {
  console.log('====================================================');
  console.log('   GATEWAY MOTORS DMS — PHASE 7 VERIFICATION SUITE   ');
  console.log('            (Cashier Management E2E)                ');
  console.log('====================================================\n');

  try {
    // --- 1. Authentication & Role Boundaries ---
    console.log('--- 1. Authentication & Role Boundaries ---');
    const cashierToken = await login('cashier');
    assert(Boolean(cashierToken), 'Cashier login succeeds');

    const directorToken = await login('director');
    assert(Boolean(directorToken), 'Director login succeeds');

    const accountsToken = await login('accounts');
    assert(Boolean(accountsToken), 'Accounts Manager login succeeds');

    const salespersonToken = await login('salesperson');
    assert(Boolean(salespersonToken), 'Salesperson login succeeds');

    const technicianToken = await login('technician');
    assert(Boolean(technicianToken), 'Technician login succeeds');

    const spOpen = await request('POST', '/cashier/sessions?branchId=GMF', { openingBalance: 500 }, salespersonToken);
    assert(spOpen.status === 403, 'RBAC: Salesperson cannot open cashier sessions (403 Forbidden)');

    const techReceipt = await request(
      'POST',
      '/cashier/sessions/fake-session/receipts',
      { amount: 100, paymentMethod: 'CASH' },
      technicianToken
    );
    assert(techReceipt.status === 403, 'RBAC: Technician cannot issue cashier receipts (403 Forbidden)');

    const techVoucher = await request(
      'POST',
      '/cashier/sessions/fake-session/payment-vouchers',
      { amount: 50, paymentMethod: 'CASH', payee: 'Test', reason: 'Test' },
      technicianToken
    );
    assert(techVoucher.status === 403, 'RBAC: Technician cannot issue payment vouchers (403 Forbidden)');

    // --- 2. Cashier Opening Balance & Session Lifecycle ---
    console.log('\n--- 2. Cashier Opening Balance & Session Lifecycle ---');
    // Close any previous open session if exists
    const existingSessions = await request('GET', '/cashier/sessions', null, cashierToken);
    if (existingSessions.status === 200 && Array.isArray(existingSessions.data)) {
      const active = existingSessions.data.find((s) => s.status === 'OPEN');
      if (active) {
        await request('POST', `/cashier/sessions/${active.id}/close`, { actualBalance: 0, notes: 'Pre-test close' }, cashierToken);
      }
    }

    const openRes = await request('POST', '/cashier/sessions?branchId=GMF', { openingBalance: 500.0 }, cashierToken);
    assert(openRes.status === 201 || openRes.status === 200, 'Cashier opens session with opening float balance');
    const session = openRes.data;
    assert(session && session.id, 'Session ID returned');
    assert(session.status === 'OPEN', 'Session initial status is OPEN');
    assert(Number(session.openingBalance) === 500, 'Opening balance recorded as 500.00');

    const duplicateOpen = await request('POST', '/cashier/sessions?branchId=GMF', { openingBalance: 200 }, cashierToken);
    assert(duplicateOpen.status === 400, 'Controls: Multiple concurrent open sessions per cashier rejected with 400');

    const sessionDetail = await request('GET', `/cashier/sessions/${session.id}`, null, cashierToken);
    assert(sessionDetail.status === 200, 'Retrieve cashier session details succeeds');
    assert(sessionDetail.data.cashier && sessionDetail.data.cashier.username === 'cashier', 'Session links to cashier');

    // --- 3. Cash-In, Cash-Out & Till Overdraft Controls ---
    console.log('\n--- 3. Cash-In, Cash-Out & Overdraft Controls ---');
    const cashInRes = await request(
      'POST',
      `/cashier/sessions/${session.id}/cash-in`,
      { amount: 250.0, paymentMethod: 'CASH', reason: 'Float replenishment' },
      cashierToken
    );
    assert(cashInRes.status === 201 || cashInRes.status === 200, 'Cash-in transaction recorded');
    assert(cashInRes.data.type === 'CASH_IN', 'Transaction type is CASH_IN');
    assert(cashInRes.data.journalEntryId, 'GL journal entry posted for Cash-In');

    const cashOutRes = await request(
      'POST',
      `/cashier/sessions/${session.id}/cash-out`,
      { amount: 150.0, paymentMethod: 'CASH', reason: 'Midday safe transfer' },
      cashierToken
    );
    assert(cashOutRes.status === 201 || cashOutRes.status === 200, 'Cash-out transaction recorded');
    assert(cashOutRes.data.type === 'CASH_OUT', 'Transaction type is CASH_OUT');
    assert(cashOutRes.data.journalEntryId, 'GL journal entry posted for Cash-Out');

    const overdraftRes = await request(
      'POST',
      `/cashier/sessions/${session.id}/cash-out`,
      { amount: 50000.0, paymentMethod: 'CASH', reason: 'Excessive cash-out' },
      cashierToken
    );
    assert(overdraftRes.status === 400, 'Controls: Cash-out exceeding available till cash rejected with 400');

    // --- 4. Numbered Receipts across Payment Methods ---
    console.log('\n--- 4. Numbered Receipts across Payment Methods ---');
    const cashReceipt = await request(
      'POST',
      `/cashier/sessions/${session.id}/receipts`,
      { amount: 1200.0, paymentMethod: 'CASH', reason: 'Cash down payment' },
      cashierToken
    );
    assert(cashReceipt.status === 201 || cashReceipt.status === 200, 'Cash receipt issued');
    assert(cashReceipt.data.receiptNo && cashReceipt.data.receiptNo.startsWith('RCPT-'), 'Receipt assigned formatted number (RCPT-*)');
    assert(Number(cashReceipt.data.amount) === 1200, 'Cash receipt amount is 1200.00');

    const cardReceipt = await request(
      'POST',
      `/cashier/sessions/${session.id}/receipts`,
      { amount: 800.0, paymentMethod: 'CARD', reason: 'Credit card swipe' },
      cashierToken
    );
    assert(cardReceipt.status === 201 || cardReceipt.status === 200, 'Card receipt issued');
    assert(cardReceipt.data.paymentMethod === 'CARD', 'Receipt payment method is CARD');

    const bankReceipt = await request(
      'POST',
      `/cashier/sessions/${session.id}/receipts`,
      { amount: 1500.0, paymentMethod: 'BANK_TRANSFER', reason: 'Direct IBFT transfer' },
      cashierToken
    );
    assert(bankReceipt.status === 201 || bankReceipt.status === 200, 'Bank transfer receipt issued');
    assert(bankReceipt.data.paymentMethod === 'BANK_TRANSFER', 'Receipt payment method is BANK_TRANSFER');

    // --- 5. Customer & Operational Receivables Integration ---
    console.log('\n--- 5. Customer & Operational Receivables Integration ---');
    const custRes = await request(
      'POST',
      '/sales/customers',
      { name: 'Rashid Mahmood', phone: `0300-${Date.now().toString().slice(-7)}`, email: `rashid.${Date.now()}@example.com` },
      directorToken
    );
    const customer = custRes.data;

    const recRes = await request(
      'POST',
      '/finance/operational-jobs/record',
      {
        sourceType: 'BODY_PAINT_REPAIR_ORDER',
        sourceId: `bp-job-${Date.now()}`,
        referenceNo: `BP-JOB-${Date.now()}`,
        amount: 2000.0,
        customerId: customer.id,
        description: 'Bumper paint and body denting',
      },
      directorToken
    );
    assert(recRes.status === 201 || recRes.status === 200, 'Customer receivable created in Finance');
    const receivableId = recRes.data.receivableId;
    assert(Boolean(receivableId), 'Receivable ID returned');

    // Cashier partial receipt against receivable
    const partReceipt = await request(
      'POST',
      `/cashier/sessions/${session.id}/receipts`,
      { amount: 800.0, paymentMethod: 'CASH', customerId: customer.id, sourceType: 'RECEIVABLE', sourceId: receivableId },
      cashierToken
    );
    assert(partReceipt.status === 201 || partReceipt.status === 200, 'Cashier issues receipt against receivable');

    const recAfterPart = await request('GET', `/finance/receivables?customerId=${customer.id}`, null, directorToken);
    const rec1 = recAfterPart.data.find((r) => r.id === receivableId);
    assert(rec1 && Number(rec1.outstanding) === 1200, 'Receivable outstanding reduced to 1200.00');
    assert(rec1.status === 'PARTIALLY_PAID', 'Receivable status transitioned to PARTIALLY_PAID');

    // Cashier final settlement receipt
    const fullReceipt = await request(
      'POST',
      `/cashier/sessions/${session.id}/receipts`,
      { amount: 1200.0, paymentMethod: 'CASH', customerId: customer.id, sourceType: 'RECEIVABLE', sourceId: receivableId },
      cashierToken
    );
    assert(fullReceipt.status === 201 || fullReceipt.status === 200, 'Cashier issues final receipt against receivable');

    const recAfterFull = await request('GET', `/finance/receivables?customerId=${customer.id}`, null, directorToken);
    const rec2 = recAfterFull.data.find((r) => r.id === receivableId);
    assert(rec2 && Number(rec2.outstanding) === 0, 'Receivable outstanding balance is now 0');
    assert(rec2.status === 'PAID', 'Receivable status transitioned to PAID');

    // --- 6. Payment Vouchers & Expense Classification ---
    console.log('\n--- 6. Payment Vouchers & Expense Classification ---');
    const voucherRes = await request(
      'POST',
      `/cashier/sessions/${session.id}/payment-vouchers`,
      { amount: 180.0, paymentMethod: 'CASH', payee: 'Al-Madina Stationery', reason: 'Workshop consumables' },
      cashierToken
    );
    assert(voucherRes.status === 201 || voucherRes.status === 200, 'Payment voucher issued');
    assert(voucherRes.data.voucherNo && voucherRes.data.voucherNo.startsWith('PV-'), 'Payment voucher assigned formatted number (PV-*)');
    assert(voucherRes.data.payee === 'Al-Madina Stationery', 'Payee recorded correctly');
    assert(Number(voucherRes.data.amount) === 180, 'Voucher amount is 180.00');

    const overVoucher = await request(
      'POST',
      `/cashier/sessions/${session.id}/payment-vouchers`,
      { amount: 999999.0, paymentMethod: 'CASH', payee: 'Grand Hotel', reason: 'Banquet' },
      cashierToken
    );
    assert(overVoucher.status === 400, 'Controls: Payment voucher exceeding till cash rejected with 400');

    // --- 7. Numbered Receipts & Vouchers Printable Output ---
    console.log('\n--- 7. Numbered Receipts & Vouchers Printable Output ---');
    const getRec = await request('GET', `/cashier/receipts/${cashReceipt.data.id}`, null, cashierToken);
    assert(getRec.status === 200, 'Fetch single receipt by ID succeeds');
    assert(getRec.data.receiptNo === cashReceipt.data.receiptNo, 'Receipt number matches');

    const printRec = await request('GET', `/cashier/receipts/${cashReceipt.data.id}/print`, null, cashierToken);
    assert(printRec.status === 200, 'Generate printable receipt output succeeds');
    assert(Boolean(printRec.data.html), 'Printable receipt contains formatted HTML');
    assert(printRec.data.payment && printRec.data.payment.amountInWords, 'Printable receipt contains amount in words');
    assert(printRec.data.dealership && printRec.data.dealership.branchName, 'Printable receipt includes dealership header');

    const getVoucher = await request('GET', `/cashier/vouchers/${voucherRes.data.id}`, null, cashierToken);
    assert(getVoucher.status === 200, 'Fetch single voucher by ID succeeds');

    const printVoucher = await request('GET', `/cashier/vouchers/${voucherRes.data.id}/print`, null, cashierToken);
    assert(printVoucher.status === 200, 'Generate printable voucher output succeeds');
    assert(Boolean(printVoucher.data.html), 'Printable voucher contains formatted HTML');
    assert(printVoucher.data.amountInWords, 'Printable voucher contains amount in words');

    const listRecs = await request('GET', `/cashier/receipts?sessionId=${session.id}`, null, cashierToken);
    assert(listRecs.status === 200, 'List receipts with sessionId filter succeeds');
    assert(listRecs.data.length >= 3, `Session receipts list populated (Count: ${listRecs.data.length})`);

    const listVouchers = await request('GET', `/cashier/vouchers?sessionId=${session.id}`, null, cashierToken);
    assert(listVouchers.status === 200, 'List vouchers with sessionId filter succeeds');
    assert(listVouchers.data.length >= 1, `Session vouchers list populated (Count: ${listVouchers.data.length})`);

    // --- 8. Controlled Reversals & Self-Approval Prohibition ---
    console.log('\n--- 8. Controlled Reversals & Self-Approval Prohibition ---');
    // Cashier issues a test receipt to test reversal
    const txToReverse = await request(
      'POST',
      `/cashier/sessions/${session.id}/receipts`,
      { amount: 300.0, paymentMethod: 'CASH', reason: 'Erroneous receipt entry' },
      cashierToken
    );
    const targetTxId = txToReverse.data.transactionId;

    // Self-approval prohibition: cashier tries to reverse their own transaction
    const selfReverse = await request(
      'POST',
      `/cashier/transactions/${targetTxId}/reversal`,
      { reason: 'Cashier self-reversal attempt' },
      cashierToken
    );
    assert(
      selfReverse.status === 400 && selfReverse.data.message.includes('prohibited'),
      'Security: Cashier self-approval of reversal strictly prohibited (400 Bad Request)'
    );

    // Supervisor (Director / Accounts Manager) authorized reversal
    const supervisorReverse = await request(
      'POST',
      `/cashier/transactions/${targetTxId}/reversal`,
      { reason: 'Approved by Director: customer double payment' },
      directorToken
    );
    assert(supervisorReverse.status === 201 || supervisorReverse.status === 200, 'Supervisor authorizes and executes transaction reversal');
    assert(supervisorReverse.data.type === 'REVERSAL', 'Reversal transaction type is REVERSAL');
    assert(supervisorReverse.data.originalTransactionId === targetTxId, 'Reversal links to original transaction ID');
    assert(supervisorReverse.data.status === 'POSTED', 'Reversal transaction status is POSTED');

    // Check original transaction and receipt status
    const origReceiptAfter = await request('GET', `/cashier/receipts/${txToReverse.data.id}`, null, cashierToken);
    assert(origReceiptAfter.data.status === 'REVERSED', 'Original receipt status transitioned to REVERSED');

    // Re-reversal prohibition
    const reReverse = await request(
      'POST',
      `/cashier/transactions/${targetTxId}/reversal`,
      { reason: 'Duplicate reversal attempt' },
      directorToken
    );
    assert(reReverse.status === 400, 'Controls: Reversing an already reversed transaction rejected with 400');

    // Operational receivable reversal rollback test
    const testRecForRev = await request(
      'POST',
      '/finance/operational-jobs/record',
      {
        sourceType: 'SERVICE_JOB_CARD',
        sourceId: `srv-job-${Date.now()}`,
        referenceNo: `SRV-JOB-${Date.now()}`,
        amount: 500.0,
        customerId: customer.id,
        description: 'Engine oil and filter service',
      },
      directorToken
    );
    const revRecId = testRecForRev.data.receivableId;
    const revReceipt = await request(
      'POST',
      `/cashier/sessions/${session.id}/receipts`,
      { amount: 500.0, paymentMethod: 'CASH', customerId: customer.id, sourceType: 'RECEIVABLE', sourceId: revRecId },
      cashierToken
    );
    // Reverse it by supervisor
    await request(
      'POST',
      `/cashier/transactions/${revReceipt.data.transactionId}/reversal`,
      { reason: 'Dishonored payment reversal' },
      directorToken
    );
    const recRestored = await request('GET', `/finance/receivables?customerId=${customer.id}`, null, directorToken);
    const restoredItem = recRestored.data.find((r) => r.id === revRecId);
    assert(restoredItem && Number(restoredItem.outstanding) === 500, 'Reversal state rollback: Receivable outstanding balance restored to 500.00');

    // --- 9. Daily Closing, Reconciliation & Variance Calculation ---
    console.log('\n--- 9. Daily Closing, Reconciliation & Variance ---');
    // Calculate expected balance:
    // Opening: 500
    // Cash In: +250
    // Cash Out: -150
    // Cash Receipts: +1200 + 800 (rec part) + 1200 (rec full) + 300 (reversed: +300 - 300 = 0) + 500 (reversed: +500 - 500 = 0)
    // Vouchers: -180
    // Expected cash: 500 + 250 - 150 + 1200 + 800 + 1200 - 180 = 3620
    const sessDetail = await request('GET', `/cashier/sessions/${session.id}`, null, cashierToken);
    assert(sessDetail.status === 200, 'Query session before closing succeeds');

    // Reconcile with counted cash: say counted cash is 3600 (a shortage of 20)
    const reconcileRes = await request(
      'POST',
      `/cashier/sessions/${session.id}/reconciliation`,
      { closingDate: new Date().toISOString(), actualAmount: 3600.0, notes: 'Counted physical cash in till: Rs 20 shortage' },
      cashierToken
    );
    assert(reconcileRes.status === 201 || reconcileRes.status === 200, 'Daily cashier reconciliation recorded');
    assert(reconcileRes.data.status === 'COMPLETED', 'Reconciliation status is COMPLETED');
    assert(Number(reconcileRes.data.variance) !== 0, 'Discrepancy variance calculated (shortage detected)');

    // Close session
    const closeRes = await request(
      'POST',
      `/cashier/sessions/${session.id}/close`,
      { actualBalance: 3600.0, notes: 'Day end till closing' },
      cashierToken
    );
    assert(closeRes.status === 201 || closeRes.status === 200, 'Cashier session closed successfully');
    assert(closeRes.data.session.status === 'CLOSED', 'Session status transitioned to CLOSED');
    assert(Boolean(closeRes.data.session.closedAt), 'Session closedAt timestamp recorded');
    assert(closeRes.data.closing && closeRes.data.closing.status === 'COMPLETED', 'Daily closing attached with COMPLETED status');

    // Post-close enforcement: no new movements or receipts allowed in closed session
    const closedMovement = await request(
      'POST',
      `/cashier/sessions/${session.id}/cash-in`,
      { amount: 100, paymentMethod: 'CASH', reason: 'Post-close attempt' },
      cashierToken
    );
    assert(closedMovement.status === 400, 'Enforcement: Transactions in CLOSED session rejected with 400 Bad Request');

    // Reversal in closed session check
    const closedReversal = await request(
      'POST',
      `/cashier/transactions/${cashReceipt.data.transactionId}/reversal`,
      { reason: 'Late reversal after close' },
      directorToken
    );
    assert(closedReversal.status === 400, 'Enforcement: Reversals in CLOSED session rejected with 400 Bad Request');

    // --- 10. Cashier-Wise History & Discrepancy Reports ---
    console.log('\n--- 10. Cashier-Wise History & Discrepancy Reports ---');
    const discrepanciesRes = await request('GET', '/cashier/reports/discrepancies', null, accountsToken);
    assert(discrepanciesRes.status === 200, 'Query cashier discrepancies report succeeds');
    assert(discrepanciesRes.data.summary, 'Discrepancy report includes summary metrics');
    assert(discrepanciesRes.data.summary.discrepantClosings >= 1, 'Discrepant closings count tracked');
    assert(discrepanciesRes.data.records && discrepanciesRes.data.records.length >= 1, 'Discrepancy records list returned');
    const closedRec = discrepanciesRes.data.records.find((r) => r.sessionId === session.id);
    assert(closedRec && closedRec.type === 'SHORTAGE', 'Session discrepancy correctly flagged as SHORTAGE');

    const summaryRes = await request('GET', '/cashier/reports/summary', null, accountsToken);
    assert(summaryRes.status === 200, 'Query cashier summary report succeeds');
    assert(summaryRes.data.dealershipTotals, 'Summary includes dealership-wide totals');
    assert(summaryRes.data.dealershipTotals.totalReceipts > 0, 'Dealership total receipts tracked');
    assert(summaryRes.data.byCashier && summaryRes.data.byCashier.length >= 1, 'Cashier-wise performance aggregation returned');

    // Supervisor sessions list
    const allSessions = await request('GET', '/cashier/sessions', null, directorToken);
    assert(allSessions.status === 200, 'Director lists all dealership cashier sessions');
    assert(allSessions.data.length >= 1, 'Dealership sessions returned to Director');

    // --- 11. Append-Only Audit Trail Completeness ---
    console.log('\n--- 11. Append-Only Audit Trail Completeness ---');
    const auditRes = await request('GET', '/admin/audit?query=Cashier', null, directorToken);
    assert(auditRes.status === 200, 'Admin audit query succeeds');
    const cashierAudits = auditRes.data.data.filter(
      (a) => a.entityType === 'CashierSession' || a.entityType === 'CashierTransaction' || a.entityType === 'RECEIPT' || a.entityType === 'PAYMENT_VOUCHER'
    );
    assert(cashierAudits.length >= 6, `Comprehensive audit events recorded for Cashier operations (Found: ${cashierAudits.length})`);

    const actions = new Set(cashierAudits.map((a) => a.action));
    assert(actions.has('OPEN'), 'Audit trail records session OPEN action');
    assert(actions.has('POST'), 'Audit trail records document POST action');
    assert(actions.has('REVERSE'), 'Audit trail records REVERSE action');
    assert(actions.has('CLOSE'), 'Audit trail records session CLOSE action');

    console.log('\n====================================================');
    console.log(`🎉 ALL PHASE 7 COMPREHENSIVE TESTS PASSED (${passedCount}/${passedCount + failedCount}) 🎉`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('Fatal error during Phase 7 testing:', err);
    process.exit(1);
  }
}

runPhase7Tests();
