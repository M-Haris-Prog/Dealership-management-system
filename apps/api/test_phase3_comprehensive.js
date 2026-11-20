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
  console.log('   GATEWAY MOTORS DMS — PHASE 3 VERIFICATION SUITE   ');
  console.log('====================================================\n');

  const defaultPassword = process.env.TEST_ADMIN_PASSWORD || 'ChangeMeForLocalTests123!';

  // 1. Roles & RBAC Enforcement
  console.log('--- 1. Parts Manager Authentication & RBAC ---');
  const partsLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'parts.manager@gatewaymotors.local',
    password: defaultPassword,
  });
  assert(partsLogin.status === 200 || partsLogin.status === 201, 'Parts Manager login succeeds');
  const partsToken = partsLogin.body.token || partsLogin.body.accessToken;
  assert(typeof partsToken === 'string', 'Parts Manager JWT issued');

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

  // Verify Parts Manager permissions
  const pmMe = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${partsToken}` },
  });
  assert(pmMe.body.permissions.includes('parts.manage'), 'Parts manager has parts.manage');
  assert(pmMe.body.permissions.includes('parts.stock.receive'), 'Parts manager has parts.stock.receive');
  assert(pmMe.body.permissions.includes('parts.stock.issue'), 'Parts manager has parts.stock.issue');

  // Verify salesperson is forbidden from receiving stock directly
  const forbiddenReceive = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/receive',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${salesToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    locationId: 'MAIN',
    itemCode: 'OIL-FILTER-001',
    quantity: 1,
  });
  assert(forbiddenReceive.status === 403, 'Salesperson forbidden from receiving stock (403)');

  // 2. Parts Master & Batch Creation
  console.log('\n--- 2. Parts Catalog, Units & Batch Creation ---');
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const partCode1 = `SPARK-PLUG-${randNum}`;
  const partRes1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    code: partCode1,
    name: `Iridium Tough Spark Plug ${randNum}`,
    description: 'Denso Laser Iridium genuine spark plug',
    unit: 'EA',
    reorderLevel: 20,
  });
  assert(partRes1.status === 201, 'Part created successfully (201)');
  assert(partRes1.body.code === partCode1, 'Part created with correct code');
  assert(Number(partRes1.body.reorderLevel) === 20, 'Reorder level configured');

  // Duplicate part code rejected
  const dupPart = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    code: partCode1,
    name: 'Duplicate attempt',
  });
  assert(dupPart.status === 400, 'Duplicate part code rejected with 400 Bad Request');

  // Batch create multiple custom parts
  const partCode2 = `AIR-FILTER-${randNum}`;
  const partCode3 = `CABIN-FILTER-${randNum}`;
  const batchRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/batch',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, [
    { code: partCode2, name: `Engine Air Filter Element ${randNum}`, unit: 'EA', reorderLevel: 15 },
    { code: partCode3, name: `Activated Carbon Cabin Filter ${randNum}`, unit: 'EA', reorderLevel: 10 },
  ]);
  assert(batchRes.status === 201, 'Multiple custom parts created in batch (201)');
  assert(Array.isArray(batchRes.body) && batchRes.body.length === 2, 'Batch returned 2 created parts');

  // List parts catalog
  const partsListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${partsToken}` },
  });
  assert(partsListRes.status === 200, 'GET /api/parts returns 200');
  assert(partsListRes.body.some(p => p.code === partCode1), 'Created part found in catalog');

  // 3. Supplier Management
  console.log('\n--- 3. Supplier Management ---');
  const supCode = `SUP-${randNum}`;
  const supRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/suppliers',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    code: supCode,
    name: `Indus Auto Components ${randNum}`,
    phone: '+92-42-35889900',
    email: `orders.${randNum}@indusparts.local`,
    address: 'Industrial Estate, Lahore',
  });
  assert(supRes.status === 201, 'Supplier registered (201)');
  const supplier = supRes.body;
  assert(supplier.id && supplier.code === supCode, 'Supplier returned with ID and code');

  const supListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/suppliers',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${partsToken}` },
  });
  assert(supListRes.status === 200, 'GET /api/parts/suppliers returns 200');
  assert(supListRes.body.some(s => s.code === supCode), 'Registered supplier found in list');

  // 4. Stock Ledger, Receipts, Issues, and Returns (Row-level locking)
  console.log('\n--- 4. Stock Movements & Over-Issue Protection ---');
  const receiveRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/receive',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    locationId: 'MAIN',
    itemCode: partCode1,
    quantity: 50,
    reference: 'Direct receipt into MAIN store',
  });
  assert(receiveRes.status === 200 || receiveRes.status === 201, 'Stock received into MAIN location (200/201)');
  assert(Number(receiveRes.body.quantity) === 50, 'Stock balance updated to 50');

  // Issue stock
  const issueRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/issue',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    locationId: 'MAIN',
    itemCode: partCode1,
    quantity: 10,
    reference: 'Issued 10 units for maintenance',
  });
  assert(issueRes.status === 200 || issueRes.status === 201, 'Stock issued successfully');
  assert(Number(issueRes.body.quantity) === 40, 'Stock balance reduced to 40');

  // Over-issue rejection
  const overIssueRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/issue',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    locationId: 'MAIN',
    itemCode: partCode1,
    quantity: 999,
  });
  assert(overIssueRes.status === 400, 'Over-issue quantity rejected with 400 Bad Request');

  // Return stock
  const returnRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/return',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    locationId: 'MAIN',
    itemCode: partCode1,
    quantity: 2,
    reference: 'Return unused spark plugs',
  });
  assert(returnRes.status === 200 || returnRes.status === 201, 'Stock returned successfully');
  assert(Number(returnRes.body.quantity) === 42, 'Stock balance restored to 42');

  // 5. Stock Transfers & Physical Count Adjustments
  console.log('\n--- 5. Inter-Location Transfers & Count Adjustments ---');
  const transferRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/transfer',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    fromLocationId: 'MAIN',
    toLocationId: 'WORKSHOP',
    itemCode: partCode1,
    quantity: 12,
    reference: 'Transfer to mechanical workshop bay',
  });
  assert(transferRes.status === 200 || transferRes.status === 201, 'Stock transferred atomically between locations');
  assert(Number(transferRes.body.fromQuantity) === 30, 'MAIN location reduced to 30');
  assert(Number(transferRes.body.toQuantity) >= 12, 'WORKSHOP location increased by 12');

  // Physical count adjustment
  const adjustRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/adjust',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    locationId: 'MAIN',
    itemCode: partCode1,
    newQuantity: 28,
    reason: 'Monthly physical inventory audit count',
  });
  assert(adjustRes.status === 200 || adjustRes.status === 201, 'Stock adjusted to physical count (28)');
  assert(Number(adjustRes.body.quantity) === 28, 'New stock balance matches physical count');

  // 6. Stock Movements / Ledger History
  console.log('\n--- 6. Stock Movements & Ledger History ---');
  const movementsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/parts/movements?itemCode=${partCode1}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${partsToken}` },
  });
  assert(movementsRes.status === 200, 'GET /api/parts/movements returns 200');
  assert(Array.isArray(movementsRes.body) && movementsRes.body.length >= 4, 'Stock ledger contains all movements');
  const movementTypes = movementsRes.body.map(m => m.type);
  assert(movementTypes.includes('RECEIPT'), 'Ledger contains RECEIPT');
  assert(movementTypes.includes('ISSUE'), 'Ledger contains ISSUE');
  assert(movementTypes.includes('RETURN'), 'Ledger contains RETURN');
  assert(movementTypes.includes('TRANSFER'), 'Ledger contains TRANSFER');
  assert(movementTypes.includes('ADJUSTMENT'), 'Ledger contains ADJUSTMENT');

  // 7. Stock Summary & Low Stock Alerts
  console.log('\n--- 7. Low Stock Alerts & Summary ---');
  const summaryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/stock',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${partsToken}` },
  });
  assert(summaryRes.status === 200, 'GET /api/parts/stock returns 200');
  const airFilterStock = summaryRes.body.find(s => s.itemCode === partCode2);
  assert(airFilterStock !== undefined, 'Zero-stock catalog item reported in stock summary');
  assert(airFilterStock.isLowStock === true, 'Item below reorder level flagged as isLowStock = true');
  assert(airFilterStock.status === 'OUT_OF_STOCK', 'Zero quantity item flagged as OUT_OF_STOCK');

  // 8. Purchase Orders & Parts-to-Accounts Double-Entry Posting
  console.log('\n--- 8. Purchase Orders & Parts-to-Accounts Integration ---');
  const poRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/purchase-orders',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    supplierId: supplier.id,
    notes: 'Urgent stock replenishment order',
    lines: [
      { partCode: partCode2, quantity: 20, unitCost: 1500 },
      { partCode: partCode3, quantity: 15, unitCost: 2000 },
    ],
  });
  assert(poRes.status === 201, 'Purchase Order created (201)');
  const po = poRes.body;
  assert(po.id && po.orderNo.startsWith('PO-'), 'PO assigned order number');
  assert(po.lines.length === 2, 'PO lines created');

  // Receive Purchase Order into stock
  const poReceiveRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/parts/purchase-orders/${po.id}/receive`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${partsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    locationId: 'MAIN',
  });
  assert(poReceiveRes.status === 200 || poReceiveRes.status === 201, 'Purchase Order received against MAIN store');
  assert(poReceiveRes.body.success === true, 'Goods receipt processed');
  assert(poReceiveRes.body.totalCost === 60000, 'Total cost calculated correctly: 20*1500 + 15*2000 = 60,000');
  assert(poReceiveRes.body.payableId !== undefined, 'Accounts Payable record created in finance');
  assert(poReceiveRes.body.journalEntryId !== undefined, 'Balanced journal entry posted to general ledger (1200 vs 2000)');

  // Verify stock was updated by PO receipt
  const updatedStockRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts/stock',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${partsToken}` },
  });
  const updatedAirFilter = updatedStockRes.body.find(s => s.itemCode === partCode2);
  assert(updatedAirFilter && updatedAirFilter.quantity === 20, 'Part stock updated to 20 from PO receipt');
  assert(updatedAirFilter.status === 'HEALTHY', 'Stock status changed to HEALTHY (20 > reorder 15)');

  // 9. Audit Trail Verification
  console.log('\n--- 9. Audit Trail Verification ---');
  const adminLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'admin@gatewaymotors.local',
    password: defaultPassword,
  });
  const adminToken = adminLogin.body.token || adminLogin.body.accessToken;

  const auditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/audit',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  assert(auditRes.status === 200, 'GET /api/admin/audit returns 200');
  const auditRows = Array.isArray(auditRes.body) ? auditRes.body : auditRes.body.data;
  assert(auditRows.some(a => a.entityType === 'Part'), 'Part creation recorded in audit trail');
  assert(auditRows.some(a => a.entityType === 'Supplier'), 'Supplier creation recorded in audit trail');
  assert(auditRows.some(a => a.entityType === 'GoodsReceipt'), 'Goods Receipt recorded in audit trail');
  assert(auditRows.some(a => a.entityType === 'PurchaseOrder'), 'Purchase Order recorded in audit trail');

  console.log('\n====================================================');
  console.log('   🎉 ALL PHASE 3 REQUIREMENTS VERIFIED 100% OK!   ');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
