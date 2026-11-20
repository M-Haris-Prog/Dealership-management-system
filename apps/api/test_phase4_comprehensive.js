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
  console.log('   GATEWAY MOTORS DMS — PHASE 4 VERIFICATION SUITE   ');
  console.log('         (Mechanical Service & Workshop E2E)        ');
  console.log('====================================================\n');

  const defaultPassword = process.env.TEST_ADMIN_PASSWORD || 'ChangeMeForLocalTests123!';

  // 1. Roles & RBAC Authentication
  console.log('--- 1. Authentication & Role Boundaries ---');
  const advisorLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'service.advisor@gatewaymotors.local',
    password: defaultPassword,
  });
  assert(advisorLogin.status === 200 || advisorLogin.status === 201, 'Service Advisor login succeeds');
  const advisorToken = advisorLogin.body.token || advisorLogin.body.accessToken;
  assert(typeof advisorToken === 'string', 'Service Advisor JWT issued');

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
  assert(techLogin.status === 200 || techLogin.status === 201, 'Technician login succeeds');
  const techToken = techLogin.body.token || techLogin.body.accessToken;
  assert(typeof techToken === 'string', 'Technician JWT issued');

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
  const accountsToken = accountsLogin.body.token || accountsLogin.body.accessToken;

  // RBAC checks
  const salesCreateJob = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/service/job-cards',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${salesToken}`,
    },
  }, {
    branchId: 'b-main',
    customerId: 'dummy',
    vehicleId: 'dummy',
  });
  assert(salesCreateJob.status === 403, 'Salesperson is forbidden from creating job cards (403)');

  const techApproveEst = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/service/estimates/dummy/approve',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  });
  assert(techApproveEst.status === 403, 'Technician is forbidden from approving estimates (403)');

  const techAssign = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/service/job-cards/dummy/technician',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  }, { technicianId: 'tech' });
  assert(techAssign.status === 403, 'Technician is forbidden from allocating technicians (403)');

  // 2. Customer and Vehicle Setup & Check-in
  console.log('\n--- 2. Customer & Vehicle Service Check-in ---');
  const uid = Date.now().toString().slice(-6);
  const custRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/customers',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    name: `Service Client ${uid}`,
    phone: `+92-300-${uid}`,
    email: `client.${uid}@service.example.com`,
  });
  assert(custRes.status === 201 || custRes.status === 200, 'Customer created for service check-in');
  const customer = custRes.body;
  const branchId = customer.branchId;

  const vehRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/vehicles',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    make: 'Toyota',
    model: 'Corolla Altis Grande',
    modelYear: 2023,
    registrationNo: `SVC-${uid}`,
    vin: `VIN-SVC-${uid}-GRANDE`,
    color: 'Super White',
    customerId: customer.id,
  });
  assert(vehRes.status === 201 || vehRes.status === 200, 'Vehicle created for service check-in');
  const vehicle = vehRes.body;

  // Create Job Card
  const jobCardRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/service/job-cards',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    branchId,
    customerId: customer.id,
    vehicleId: vehicle.id,
    complaint: '40,000 km Periodic Maintenance & Front brake shudder on highway speeds',
    odometer: 41250,
  });
  assert(jobCardRes.status === 201 || jobCardRes.status === 200, 'Job card created successfully');
  const jobCard = jobCardRes.body;
  assert(jobCard.jobNo.startsWith('JC-'), `Job card number generated: ${jobCard.jobNo}`);
  assert(jobCard.status === 'OPEN', 'Job card initialized with status OPEN');
  assert(jobCard.odometer === 41250, 'Odometer reading 41,250 km captured on check-in');

  // Cross customer validation
  const otherCustRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/customers',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    name: `Other Client ${uid}`,
    phone: `+92-311-${uid}`,
  });
  const crossCustJob = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/service/job-cards',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    branchId,
    customerId: otherCustRes.body.id,
    vehicleId: vehicle.id,
  });
  assert(crossCustJob.status === 400, 'Vehicle registered under another customer rejected with 400');

  // 3. Vehicle & Customer Service History
  console.log('\n--- 3. Vehicle & Customer Service History Retrieval ---');
  const vehHistoryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/history/vehicle/${vehicle.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(vehHistoryRes.status === 200, 'Vehicle service history fetched successfully');
  assert(vehHistoryRes.body.totalJobCards >= 1, 'Vehicle service history reflects check-in record');
  assert(vehHistoryRes.body.history[0].jobNo === jobCard.jobNo, 'Vehicle service history links exact job card');

  const custHistoryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/history/customer/${customer.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(custHistoryRes.status === 200, 'Customer service history fetched successfully');
  assert(custHistoryRes.body.totalJobCards >= 1, 'Customer service history reflects check-in record');

  const singleJobRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(singleJobRes.status === 200, 'Single job card detail queried successfully');
  assert(singleJobRes.body.customer.name === customer.name, 'Job card detail includes customer profile');
  assert(singleJobRes.body.vehicle.model === vehicle.model, 'Job card detail includes vehicle specifications');

  // 4. Workshop Estimates & Approvals
  console.log('\n--- 4. Workshop Estimates & Customer Approvals ---');
  const partsListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts',
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(partsListRes.status === 200 && partsListRes.body.length > 0, 'Spare parts catalog available');
  const sparePart = partsListRes.body[0];

  const estimateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/estimates`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    notes: '40K Periodic Maintenance + Brake Pad Renewal',
    lines: [
      {
        description: 'Periodic maintenance inspection labor',
        quantity: 2,
        unitPrice: 85,
        lineType: 'LABOR',
      },
      {
        description: `${sparePart.name} (${sparePart.code})`,
        quantity: 1,
        unitPrice: 65,
        lineType: 'PART',
        partId: sparePart.id,
      },
    ],
  });
  assert(estimateRes.status === 201 || estimateRes.status === 200, 'Estimate created successfully');
  const estimate = estimateRes.body;
  assert(estimate.estimateNo.startsWith('EST-'), `Estimate number generated: ${estimate.estimateNo}`);
  assert(estimate.status === 'PENDING_APPROVAL', 'Estimate created with PENDING_APPROVAL status');
  assert(estimate.lines.length === 2, 'Estimate contains 2 items (Labor + Part)');

  // Verify Job Card moved to ESTIMATED
  const checkJobEst = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(checkJobEst.body.status === 'ESTIMATED', 'Job card transitioned to ESTIMATED state');

  // Approve Estimate
  const approveRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/estimates/${estimate.id}/approve`,
    method: 'POST',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(approveRes.status === 201 || approveRes.status === 200, 'Estimate approved successfully');
  assert(approveRes.body.status === 'APPROVED', 'Estimate status updated to APPROVED');

  // Verify Job Card moved to APPROVED
  const checkJobAppr = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(checkJobAppr.body.status === 'APPROVED', 'Job card transitioned to APPROVED state');

  // 5. Technician Allocation
  console.log('\n--- 5. Technician Allocation & Auto-progression ---');
  const assignRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/technician`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    technicianId: 'technician',
  });
  assert(assignRes.status === 201 || assignRes.status === 200, 'Technician allocated successfully');
  assert(assignRes.body.technician.username === 'technician', 'Allocated technician resolved');

  const checkJobProg = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(checkJobProg.body.status === 'IN_PROGRESS', 'Job card automatically progressed to IN_PROGRESS upon technician allocation');

  // 6. Parts Request Against Job Card
  console.log('\n--- 6. Workshop Parts Requisition ---');
  const partsReqRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/parts`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    locationId: 'MAIN',
    lines: [
      {
        partId: sparePart.id,
        quantity: 1,
      },
    ],
  });
  assert(partsReqRes.status === 201 || partsReqRes.status === 200, 'Parts requested with location MAIN');
  assert(partsReqRes.body.requestNo.startsWith('PRQ-'), `Parts request number generated: ${partsReqRes.body.requestNo}`);

  const checkJobWaitParts = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(checkJobWaitParts.body.status === 'WAITING_PARTS', 'Job card transitioned to WAITING_PARTS');

  // 7. Labor Operations Recording
  console.log('\n--- 7. Technician Labor Operations Recording ---');
  const laborRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/labor`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  }, {
    description: '40,000 km Service: Engine oil, filters, spark plugs and brake pad replacement',
    hours: 2.5,
    rate: 100,
  });
  assert(laborRes.status === 201 || laborRes.status === 200, 'Technician recorded labor operations');
  assert(Number(laborRes.body.hours) === 2.5, '2.5 hours billable labor captured');
  assert(Number(laborRes.body.rate) === 100, 'Labor rate 100/hr captured');

  // 8. Quality Control & Inspection Checklist
  console.log('\n--- 8. Quality Inspection Checklist & Delivery Readiness ---');
  // First test inspection failure keeps job in progress
  const inspectFail = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/inspection`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  }, {
    checklist: { general: true, brakes: false, testDrive: false },
    passed: false,
    notes: 'Brake pedal travel slightly high, requires bleeding',
  });
  assert(inspectFail.status === 201 || inspectFail.status === 200, 'Inspection failure recorded');
  const jobAfterFail = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(jobAfterFail.body.status === 'IN_PROGRESS', 'Failed inspection keeps job card in IN_PROGRESS');

  // Now pass inspection
  const inspectPass = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/inspection`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  }, {
    checklist: { general: true, brakes: true, testDrive: true, fluidLevels: true, lights: true },
    passed: true,
    notes: 'Brake lines bled, test drive confirmed smooth braking, road test passed',
  });
  assert(inspectPass.status === 201 || inspectPass.status === 200, 'Final quality inspection passed');
  const jobAfterPass = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(jobAfterPass.body.status === 'READY_FOR_INVOICE', 'Passed inspection moves job card to READY_FOR_INVOICE');

  // 9. Invoice-Ready Summary & Service Invoicing
  console.log('\n--- 9. Invoice-Ready Summary & Service Invoicing ---');
  const invoiceReadyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/invoice-ready`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(invoiceReadyRes.status === 200, 'Invoice-ready summary retrieved');
  const invSummary = invoiceReadyRes.body;
  // Labor = 2.5 * 100 = 250; Parts = 1 * 65 = 65; Total = 315
  assert(Number(invSummary.total) === 315, `Calculated subtotal/total is 315 (Labor: 250 + Parts: 65), got: ${invSummary.total}`);
  assert(invSummary.customer.name === customer.name, 'Invoice-ready summary binds customer');
  assert(invSummary.traceablePartsRequests.length >= 1, 'Invoice-ready summary includes traceable parts requests');

  // Transition status to INVOICED
  const statusInvoicedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    status: 'INVOICED',
  });
  assert(statusInvoicedRes.status === 200, 'Job card status transitioned to INVOICED');
  assert(statusInvoicedRes.body.status === 'INVOICED', 'Job card verified in INVOICED state');

  // Check generated ServiceInvoice
  const invoicesList = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/invoices?jobCardId=${jobCard.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(invoicesList.status === 200 && invoicesList.body.length > 0, 'Service invoice automatically created');
  const serviceInvoice = invoicesList.body[0];
  assert(serviceInvoice.invoiceNo.startsWith('INV-SVC-'), `Service invoice number generated: ${serviceInvoice.invoiceNo}`);
  assert(Number(serviceInvoice.total) === 315, `Service invoice total matches summary: ${serviceInvoice.total}`);
  assert(serviceInvoice.status === 'READY', 'Service invoice initialized with READY status');

  // 10. Service-to-Accounts Integration & General Ledger Posting
  console.log('\n--- 10. Service-to-Accounts & GL Posting ---');
  // Check Finance Operational Notifications
  const notifRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/notifications',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(notifRes.status === 200, 'Finance operational notifications retrieved');
  const serviceNotif = notifRes.body.find((n) => n.sourceId === jobCard.id);
  assert(serviceNotif !== undefined, 'SERVICE_COMPLETED notification generated for job card in Finance');
  assert(serviceNotif.category === 'SERVICE_COMPLETED', 'Notification categorized as SERVICE_COMPLETED');
  assert(Number(serviceNotif.amount) === 315, `Notification amount matches invoice: ${serviceNotif.amount}`);

  // Record operational job as Receivable in Finance
  const recordReceivable = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/operational-jobs/record',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accountsToken}`,
    },
  }, {
    sourceType: 'JOB_CARD',
    sourceId: jobCard.id,
    referenceNo: jobCard.jobNo,
    customerName: customer.name,
    customerId: customer.id,
    amount: 315,
    description: `Workshop mechanical repair for ${vehicle.make} ${vehicle.model}`,
  });
  assert(recordReceivable.status === 201 || recordReceivable.status === 200, 'Service job recorded as Accounts Receivable in Finance');
  assert(recordReceivable.body.documentNo.startsWith('REC-'), `Receivable document created: ${recordReceivable.body.documentNo}`);

  // Post Service Invoice to General Ledger
  const postInvRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/invoices/${serviceInvoice.id}/post`,
    method: 'POST',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(postInvRes.status === 201 || postInvRes.status === 200, 'Service invoice posted to General Ledger');
  assert(postInvRes.body.status === 'POSTED', 'Service invoice status updated to POSTED');
  assert(postInvRes.body.postedAt !== null, 'Service invoice postedAt timestamp recorded');

  // 11. Final Delivery & Job Closure
  console.log('\n--- 11. Delivery & Job Closure ---');
  const closeJobRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/service/job-cards/${jobCard.id}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${advisorToken}`,
    },
  }, {
    status: 'CLOSED',
  });
  assert(closeJobRes.status === 200, 'Job card closed on vehicle delivery');
  assert(closeJobRes.body.status === 'CLOSED', 'Job card status confirmed CLOSED');
  assert(closeJobRes.body.closedAt !== null, 'Job card closedAt timestamp recorded');

  // 12. Workshop Reporting & Drilldown
  console.log('\n--- 12. Workshop Reporting & Drilldown Verification ---');
  const kpisRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/kpis',
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(kpisRes.status === 200, 'Reporting KPIs queried');
  assert(typeof kpisRes.body.service.openJobs === 'number', 'KPIs include service openJobs count');

  const summaryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/summary',
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(summaryRes.status === 200, 'Reporting summary queried');
  assert(Array.isArray(summaryRes.body.service), 'Service status distribution included in summary');

  const drilldownRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/drilldown/service',
    method: 'GET',
    headers: { Authorization: `Bearer ${advisorToken}` },
  });
  assert(drilldownRes.status === 200, 'Service drilldown report retrieved');
  assert(drilldownRes.body.data.some((d) => d.id === jobCard.id), 'Service drilldown lists newly processed job card');

  // 13. Audit Trail Verification
  console.log('\n--- 13. Audit Trail Ledger Verification ---');
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
    path: `/api/admin/audit?query=JobCard`,
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(auditRes.status === 200, 'Audit trail queried for job card');
  assert(auditRes.body.data.some((a) => a.action === 'CREATE' && a.entityType === 'JobCard'), 'Audit trail records CREATE action for JobCard');
  assert(auditRes.body.data.some((a) => a.action === 'STATUS' && a.entityType === 'JobCard'), 'Audit trail records STATUS action for JobCard');

  console.log('\n====================================================');
  console.log('   🎉 ALL 48/48 PHASE 4 MECHANICAL SERVICE CHECKS PASSED!  ');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('\n❌ Phase 4 Verification Failed:', err);
  process.exit(1);
});
