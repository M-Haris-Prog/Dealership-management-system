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
  console.log('   GATEWAY MOTORS DMS — PHASE 2 VERIFICATION SUITE   ');
  console.log('====================================================\n');

  const defaultPassword = process.env.TEST_ADMIN_PASSWORD || 'ChangeMeForLocalTests123!';

  // 1. Authentication & Role Permissions
  console.log('--- 1. Sales Roles Authentication & RBAC ---');
  const salespersonLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'salesperson@gatewaymotors.local',
    password: defaultPassword,
  });
  assert(salespersonLogin.status === 200 || salespersonLogin.status === 201, 'Salesperson login succeeds');
  const salespersonToken = salespersonLogin.body.token || salespersonLogin.body.accessToken;
  assert(typeof salespersonToken === 'string', 'Salesperson JWT issued');

  const salesManagerLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'sales.manager@gatewaymotors.local',
    password: defaultPassword,
  });
  assert(salesManagerLogin.status === 200 || salesManagerLogin.status === 201, 'Sales Manager login succeeds');
  const salesManagerToken = salesManagerLogin.body.token || salesManagerLogin.body.accessToken;

  const technicianLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'technician@gatewaymotors.local',
    password: defaultPassword,
  });
  const technicianToken = technicianLogin.body.token || technicianLogin.body.accessToken;

  // Verify salesperson permissions
  const spMe = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${salespersonToken}` },
  });
  assert(spMe.body.permissions.includes('sales.customer.create'), 'Salesperson has sales.customer.create');
  assert(spMe.body.permissions.includes('sales.vehicle.create'), 'Salesperson has sales.vehicle.create');
  assert(spMe.body.permissions.includes('sales.booking.create'), 'Salesperson has sales.booking.create');
  assert(!spMe.body.permissions.includes('users.manage'), 'Salesperson does not have admin permissions');

  // Verify technician cannot create a sales booking (RBAC enforcement)
  const forbiddenBooking = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/bookings',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${technicianToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    bookingNo: 'FORBIDDEN-001',
    bookingDate: new Date().toISOString(),
  });
  assert(forbiddenBooking.status === 403, 'Technician forbidden from creating sales bookings (403)');

  // 2. Customer Lifecycle & Unique ID Auto-generation
  console.log('\n--- 2. Customer Management & Auto ID Generation ---');
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const custRes1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/customers',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${salespersonToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    name: `Tariq Mehmood ${randNum}`,
    phone: `+92-300-${randNum}123`,
    email: `tariq.${randNum}@example.com`,
    address: 'Gulberg III, Lahore',
  });
  assert(custRes1.status === 201, 'Customer created successfully (201)');
  assert(custRes1.body.sourceId && custRes1.body.sourceId.startsWith('CUST-'), `Automatic unique Customer ID assigned: ${custRes1.body.sourceId}`);
  const customer1 = custRes1.body;

  // Create another customer to ensure unique increment
  const custRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/customers',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${salespersonToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    name: `Ayesha Khan ${randNum}`,
    phone: `+92-321-${randNum}456`,
  });
  assert(custRes2.status === 201, 'Second customer created successfully');
  assert(custRes2.body.sourceId !== customer1.sourceId, 'Subsequent customer gets distinct auto-generated ID');
  const customer2 = custRes2.body;

  // List customers
  const custListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/customers',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${salespersonToken}` },
  });
  assert(custListRes.status === 200, 'GET /api/sales/customers returns 200');
  assert(Array.isArray(custListRes.body) && custListRes.body.length >= 2, 'Customer list contains created customers');
  const foundCust = custListRes.body.find(c => c.id === customer1.id);
  assert(foundCust && foundCust.sourceId === customer1.sourceId, 'Listed customer preserves unique customer ID');

  // 3. Vehicle Stock & Inventory
  console.log('\n--- 3. Vehicle Stock Management ---');
  const regNo = `GTR-${randNum}`;
  const vinNo = `1HGCR2F83HA${randNum}`;
  const vehRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/vehicles',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${salespersonToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    registrationNo: regNo,
    vin: vinNo,
    make: 'Toyota',
    model: 'Corolla Altis Grande',
    modelYear: 2024,
    color: 'Super White',
    price: 7850000,
  });
  assert(vehRes.status === 201, 'Vehicle added to sales inventory (201)');
  const vehicle = vehRes.body;
  assert(vehicle.id && vehicle.registrationNo === regNo, 'Vehicle registered with registration and VIN');

  // List vehicles
  const vehListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/vehicles',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${salespersonToken}` },
  });
  assert(vehListRes.status === 200, 'GET /api/sales/vehicles returns 200');
  const foundVeh = vehListRes.body.find(v => v.id === vehicle.id);
  assert(foundVeh && foundVeh.make === 'Toyota', 'Created vehicle found in inventory list');

  // 4. Sales Leads & Prospect Management
  console.log('\n--- 4. Leads & Prospect Management ---');
  const leadRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/leads',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${salespersonToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    customerId: customer1.id,
    name: customer1.name,
    phone: customer1.phone,
    interest: 'Toyota Corolla Altis Grande 2024 White',
    status: 'QUALIFIED',
    sourceType: 'SHOWROOM_WALK_IN',
  });
  assert(leadRes.status === 201, 'Sales lead created (201)');
  const lead = leadRes.body;
  assert(lead.id && lead.status === 'QUALIFIED', 'Lead marked as QUALIFIED');

  // List leads
  const leadListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/leads',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${salespersonToken}` },
  });
  assert(leadListRes.status === 200, 'GET /api/sales/leads returns 200');
  const foundLead = leadListRes.body.find(l => l.id === lead.id);
  assert(foundLead && foundLead.interest.includes('Corolla'), 'Created lead found in leads list');

  // 5. Booking Creation & Vehicle Orders
  console.log('\n--- 5. Vehicle Orders & Bookings ---');
  const bookingNo = `BK-${Date.now().toString(36).toUpperCase()}`;
  const bookingDate = new Date().toISOString();
  const bookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/bookings',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${salespersonToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    bookingNo,
    bookingDate,
    status: 'CONFIRMED',
    customerId: customer1.id,
    vehicleId: vehicle.id,
    leadId: lead.id,
    notes: 'Down payment verified; allocation confirmed for delivery.',
  });
  assert(bookingRes.status === 201, 'Vehicle booking / sales order created (201)');
  const booking = bookingRes.body;
  assert(booking.id && booking.bookingNo === bookingNo, 'Booking returned with unique booking number');
  assert(booking.customerId === customer1.id, 'Booking linked to customer');
  assert(booking.vehicleId === vehicle.id, 'Booking linked to vehicle');

  // List bookings
  const bookingListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/bookings',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${salespersonToken}` },
  });
  assert(bookingListRes.status === 200, 'GET /api/sales/bookings returns 200');
  const foundBooking = bookingListRes.body.find(b => b.id === booking.id);
  assert(foundBooking !== undefined, 'Created booking found in bookings list');
  assert(foundBooking.customerName && foundBooking.customerName.includes('Tariq'), 'Booking contains enriched customer name');
  assert(foundBooking.customerCode && foundBooking.customerCode.startsWith('CUST-'), 'Booking contains customer unique code');
  assert(foundBooking.vehicleName && foundBooking.vehicleName.includes('Toyota'), 'Booking contains enriched vehicle make/model');

  // Test booking status update (e.g. delivery / completion)
  const updateStatusRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/sales/bookings/${booking.id}/status`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${salespersonToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    status: 'COMPLETED',
    notes: 'PDI passed, customer verified allocation and took delivery.',
  });
  assert(updateStatusRes.status === 200, 'Booking status updated via PATCH /api/sales/bookings/:id/status (200)');
  assert(updateStatusRes.body.status === 'COMPLETED', 'Booking status transitioned to COMPLETED');
  assert(updateStatusRes.body.notes && updateStatusRes.body.notes.includes('took delivery'), 'Status update notes recorded');

  // 6. Sales-to-Accounts Notification & Receivables
  console.log('\n--- 6. Sales-to-Accounts Integration ---');
  const accountsLogin = await request({
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

  // Check finance operational notifications
  const notifRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accountsToken}` },
  });
  assert(notifRes.status === 200, 'GET /api/finance/notifications returns 200');
  const saleNotif = notifRes.body.find(n => n.sourceId === booking.id);
  assert(saleNotif !== undefined, 'Confirmed vehicle sale generated notification for Accounts & Finance');
  assert(saleNotif.category === 'VEHICLE_SALE_CONFIRMED', 'Notification category is VEHICLE_SALE_CONFIRMED');

  // Record vehicle sale as receivable
  const recordRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/notifications/record',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accountsToken}`,
      'Content-Type': 'application/json',
    },
  }, {
    sourceType: saleNotif.sourceType,
    sourceId: saleNotif.sourceId,
    amount: saleNotif.amount,
    customerId: saleNotif.customerId,
    referenceNo: saleNotif.referenceNo,
    description: saleNotif.title,
  });
  assert(recordRes.status === 200 || recordRes.status === 201, 'Accounts recorded sale as receivable');
  assert(recordRes.body.success === true, 'Receivable creation succeeded');
  assert(recordRes.body.receivableId !== undefined, 'Receivable ID returned');

  // 7. Reporting & Analytics
  console.log('\n--- 7. Sales KPIs & Drilldown Reporting ---');
  const kpisRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/kpis',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${salesManagerToken}` },
  });
  assert(kpisRes.status === 200, 'GET /api/reporting/kpis returns 200 for Sales Manager');
  assert(kpisRes.body.sales && typeof kpisRes.body.sales.bookings === 'number', 'Sales KPI returns booking metrics');

  const drillRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/drilldown/sales',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${salesManagerToken}` },
  });
  assert(drillRes.status === 200, 'GET /api/reporting/drilldown/sales returns 200');
  assert(Array.isArray(drillRes.body.data) && drillRes.body.total >= 1, 'Sales drilldown report contains booking rows');

  // 8. Audit Trail Verification
  console.log('\n--- 8. Audit Trail Verification ---');
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
  const customerAudit = auditRows.find(a => a.entityType === 'Customer' && a.entityId === customer1.id);
  const vehicleAudit = auditRows.find(a => a.entityType === 'Vehicle' && a.entityId === vehicle.id);
  const leadAudit = auditRows.find(a => a.entityType === 'Lead' && a.entityId === lead.id);
  const bookingAudit = auditRows.find(a => a.entityType === 'Booking' && a.entityId === booking.id);
  assert(customerAudit !== undefined, 'Customer creation logged in audit trail');
  assert(vehicleAudit !== undefined, 'Vehicle registration logged in audit trail');
  assert(leadAudit !== undefined, 'Lead creation logged in audit trail');
  assert(bookingAudit !== undefined, 'Booking creation logged in audit trail');

  console.log('\n====================================================');
  console.log('   🎉 ALL PHASE 2 REQUIREMENTS VERIFIED 100% OK!   ');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
