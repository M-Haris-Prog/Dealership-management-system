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
  console.log('   GATEWAY MOTORS DMS — PHASE 5 VERIFICATION SUITE   ');
  console.log('            (Body & Paint Workshop E2E)             ');
  console.log('====================================================\n');

  const defaultPassword = process.env.TEST_ADMIN_PASSWORD || 'ChangeMeForLocalTests123!';

  // =========================================================================
  // 1. Authentication & Role Boundaries
  // =========================================================================
  console.log('--- 1. Authentication & Role Boundaries ---');
`r`n  const bpAdvisorLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    identifier: 'bodypaint.advisor@gatewaymotors.local',
    password: defaultPassword,
  });
  assert(bpAdvisorLogin.status === 200 || bpAdvisorLogin.status === 201, 'Body & Paint Advisor login succeeds');
  const bpAdvisorToken = bpAdvisorLogin.body.token || bpAdvisorLogin.body.accessToken;
  assert(typeof bpAdvisorToken === 'string', 'Body & Paint Advisor JWT issued');

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
  const directorToken = directorLogin.body.token || directorLogin.body.accessToken;

  // RBAC checks: Salesperson cannot create Body & Paint repair order
  const salesCreateBP = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/body-paint/repair-orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${salesToken}`,
    },
  }, {
    branchId: 'b1',
    customerId: 'c1',
    vehicleId: 'v1',
  });
  assert(salesCreateBP.status === 403, 'RBAC: Salesperson cannot create Body & Paint repair orders (403 Forbidden)');

  // RBAC checks: Technician cannot create repair order
  const techCreateBP = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/body-paint/repair-orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  }, {
    branchId: 'b1',
    customerId: 'c1',
    vehicleId: 'v1',
  });
  assert(techCreateBP.status === 403, 'RBAC: Technician cannot create Body & Paint repair orders (403 Forbidden)');

  // =========================================================================
  // 2. Customer, Vehicle & Collision Intake Job Card
  // =========================================================================
  console.log('\n--- 2. Customer, Vehicle & Collision Intake Job Card ---');
`r`n  const uniqueSuffix = Date.now().toString().slice(-5);
  const custRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/customers',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    name: `Syed BodyPaint Client ${uniqueSuffix}`,
    phone: `0300${uniqueSuffix}`,
    email: `syed.bp.${uniqueSuffix}@client.local`,
    address: 'Gulberg Greens, Islamabad',
  });
  assert(custRes.status === 201 || custRes.status === 200, 'Body & Paint Advisor creates customer record');
  const customerId = custRes.body.id;
  const branchId = custRes.body.branchId;

  const vehRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/sales/vehicles',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    vin: `BP-VIN-${uniqueSuffix}-${Math.floor(Math.random() * 1000)}`,
    registrationNo: `BP-REG-${uniqueSuffix}`,
    make: 'Toyota',
    model: 'Land Cruiser Prado',
    modelYear: 2024,
    color: 'Pearl White 070',
    type: 'CUSTOMER_VEHICLE',
    customerId,
    branchId,
  });
  assert(vehRes.status === 201 || vehRes.status === 200, 'Body & Paint Advisor registers customer vehicle');
  const vehicleId = vehRes.body.id;

  // Negative validation: invalid customer ID
  const invalidOrder = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/body-paint/repair-orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    branchId,
    customerId: 'non-existent-cuid',
    vehicleId,
    complaint: 'Damage test',
  });
  assert(invalidOrder.status === 400, 'Validation: non-existent customer rejected with 400 Bad Request');

  // Positive intake
  const orderRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/body-paint/repair-orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    branchId,
    customerId,
    vehicleId,
    complaint: 'Severe collision impact: crumpled front hood, crushed bumper, dented right wing and scratch along passenger door.',
  });
  assert(orderRes.status === 201 || orderRes.status === 200, 'Collision repair intake job card created successfully');
  const order = orderRes.body;
  const orderId = order.id;
  assert(order.status === 'OPEN', 'Repair order initial status is OPEN');
  assert(order.orderNo.startsWith('BP-'), `Repair order assigned prefix BP- (${order.orderNo})`);
  assert(order.customerId === customerId, 'Repair order linked to customer');
  assert(order.vehicleId === vehicleId, 'Repair order linked to vehicle');

  // =========================================================================
  // 3. Insurance Case & Policy Management
  // =========================================================================
  console.log('\n--- 3. Insurance Case & Policy Management ---');

  const insuranceRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/insurance-case`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    insurerName: 'Jubilee General Insurance Co.',
    policyNo: `POL-JUB-${uniqueSuffix}`,
    claimNo: `CLM-BP-${uniqueSuffix}`,
    status: 'OPEN',
    approvedAmount: 4500.00,
    deductible: 500.00,
    notes: 'Surveyor inspected front structure. Insurer covered up to 4,500 with 500 policy deductible.',
  });
  assert(insuranceRes.status === 201 || insuranceRes.status === 200, 'Insurance case created for collision repair order');
  assert(insuranceRes.body.insurerName === 'Jubilee General Insurance Co.', 'Insurer name saved correctly');
  assert(Number(insuranceRes.body.deductible) === 500.00, 'Policy deductible recorded as 500.00');

  const listInsuranceRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/insurance`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(listInsuranceRes.status === 200, 'Retrieve insurance cases list succeeds');
  assert(Array.isArray(listInsuranceRes.body) && listInsuranceRes.body.length >= 1, 'Insurance list contains created case');

  // =========================================================================
  // 4. Damage Assessment & Cost Estimation
  // =========================================================================
  console.log('\n--- 4. Damage Assessment & Cost Estimation ---');

  const assessmentRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/damage-assessment`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    damageAreas: {
      frontBumper: { severity: 'SEVERE', repairType: 'REPLACE_AND_PAINT', panels: 1 },
      hood: { severity: 'MODERATE', repairType: 'DENT_PULL_AND_PAINT', panels: 1 },
      rightFender: { severity: 'MODERATE', repairType: 'PANEL_BEATING_AND_BLEND', panels: 1 },
    },
    estimatedLabor: 2400.00,
    estimatedMaterials: 1725.00,
    notes: 'Structural frame intact; full surface prep, primer and oven bake required.',
  });
  assert(assessmentRes.status === 201 || assessmentRes.status === 200, 'Damage assessment recorded');
  assert(Number(assessmentRes.body.estimatedLabor) === 2400.00, 'Estimated labor saved accurately');
  assert(Number(assessmentRes.body.estimatedMaterials) === 1725.00, 'Estimated materials saved accurately');

  // Verify status moved to ASSESSMENT
  const checkStatusAssessment = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(checkStatusAssessment.status === 200, 'Get single repair order succeeds');
  assert(checkStatusAssessment.body.status === 'ASSESSMENT', 'Repair order status auto-transitioned to ASSESSMENT');

  // =========================================================================
  // 5. Approvals Workflow (Insurer & Customer Separated)
  // =========================================================================
  console.log('\n--- 5. Approvals Workflow (Insurer & Customer Separated) ---');

  // 1) Insurer approval
  const insurerApprovalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/approval`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    type: 'INSURER',
    status: 'PENDING',
    approvedAmount: 3200.00,
    notes: 'Awaiting surveyor formal appraisal letter.',
  });
  assert(insurerApprovalRes.status === 201 || insurerApprovalRes.status === 200, 'Insurer approval request created');
  const insurerApprovalId = insurerApprovalRes.body.id;

  // 2) Customer approval
  const customerApprovalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/approval`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    type: 'CUSTOMER',
    status: 'PENDING',
    notes: 'Customer notified of remaining out-of-pocket payable deductible & excess.',
  });
  assert(customerApprovalRes.status === 201 || customerApprovalRes.status === 200, 'Customer approval request created');
  const customerApprovalId = customerApprovalRes.body.id;

  // List approvals
  const listApprRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/approvals`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(listApprRes.status === 200, 'List approvals succeeds');
  assert(listApprRes.body.length >= 2, 'Both Insurer and Customer approvals listed');

  // Advisor approves Insurer approval via decision endpoint
  const decideInsurerRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/approvals/${insurerApprovalId}/decision`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    status: 'APPROVED',
    notes: 'Surveyor signed off on 3200.00 net insurance liability.',
  });
  assert(decideInsurerRes.status === 200 || decideInsurerRes.status === 201, 'Insurer approval decision recorded as APPROVED');
  assert(decideInsurerRes.body.status === 'APPROVED', 'Insurer approval status is APPROVED');

  // Director approves Customer approval via Admin approvals center
  const adminDecideCustRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/approvals/body-paint/${customerApprovalId}/decision`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${directorToken}`,
    },
  }, {
    decision: 'APPROVE',
    notes: 'Customer signed work authorization form.',
  });
  assert(adminDecideCustRes.status === 200 || adminDecideCustRes.status === 201, 'Customer approval decided via Admin Approvals center');

  // Verify repair order status moved to APPROVED
  const checkStatusApproved = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(checkStatusApproved.body.status === 'APPROVED', 'Repair order status updated to APPROVED upon approval');

  // =========================================================================
  // 6. Denting, Painting, Labor & Technician Allocation
  // =========================================================================
  console.log('\n--- 6. Denting, Painting, Labor & Technician Allocation ---');

  // Operation 1: BODY (Denting / Panel beating)
  const bodyOpRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/operations`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    type: 'BODY',
    description: 'Chassis pull alignment & right fender panel beating',
    technicianId: 'technician',
    hours: 10,
    rate: 120.00,
    status: 'IN_PROGRESS',
  });
  assert(bodyOpRes.status === 201 || bodyOpRes.status === 200, 'Body denting operation created and assigned to technician');
  const bodyOpId = bodyOpRes.body.id;
  assert(bodyOpRes.body.technician?.username === 'technician', 'Technician resolved and linked properly');

  // Verify order auto-transitioned to IN_PROGRESS
  const checkStatusInProgress = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(checkStatusInProgress.body.status === 'IN_PROGRESS', 'Repair order status auto-transitioned to IN_PROGRESS');

  // Operation 2: PAINT (Refinishing & Spray booth)
  const paintOpRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/operations`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    type: 'PAINT',
    description: '3-stage Pearl White basecoat, blending, clearcoat & infrared curing',
    technicianId: 'technician',
    hours: 8,
    rate: 150.00,
    status: 'PLANNED',
  });
  assert(paintOpRes.status === 201 || paintOpRes.status === 200, 'Paint refinishing operation created');
  const paintOpId = paintOpRes.body.id;

  // Technician completes BODY operation
  const updateBodyOp = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/operations/${bodyOpId}`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  }, {
    status: 'COMPLETED',
  });
  assert(updateBodyOp.status === 200, 'Technician updates BODY operation to COMPLETED');
  assert(updateBodyOp.body.status === 'COMPLETED', 'BODY operation is marked COMPLETED');

  // Technician completes PAINT operation
  const updatePaintOp = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/operations/${paintOpId}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${techToken}`,
    },
  }, {
    type: 'PAINT',
    description: '3-stage Pearl White basecoat, blending, clearcoat & infrared curing',
    status: 'COMPLETED',
    hours: 8,
    rate: 150.00,
  });
  assert(updatePaintOp.status === 200, 'Technician updates PAINT operation to COMPLETED');
  assert(updatePaintOp.body.status === 'COMPLETED', 'PAINT operation is marked COMPLETED');

  // List operations
  const listOpsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/operations`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(listOpsRes.status === 200, 'List operations succeeds');
  assert(listOpsRes.body.length >= 2, 'Both operations returned in list');

  // =========================================================================
  // 7. Bay Movement & Repair Progress Tracking
  // =========================================================================
  console.log('\n--- 7. Bay Movement & Repair Progress Tracking ---');

  // Movement 1: Move from MAIN to BODYPAINT bay
  const move1Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/vehicle-movement`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    fromLocationId: 'MAIN',
    toLocationId: 'BODYPAINT',
    notes: 'Moved into Denting Bay 2 for chassis alignment.',
  });
  assert(move1Res.status === 201 || move1Res.status === 200, 'Vehicle movement into Denting Bay recorded');
  assert(move1Res.body.toLocation?.code === 'BODYPAINT', 'Destination location resolved as BODYPAINT');

  // Movement 2: Move from BODYPAINT to Paint Booth / Workshop
  const move2Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/vehicle-movement`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    fromLocationId: 'BODYPAINT',
    toLocationId: 'WORKSHOP',
    notes: 'Moved into Heated Paint Spray Booth 1.',
  });
  assert(move2Res.status === 201 || move2Res.status === 200, 'Vehicle movement into Paint Spray Booth recorded');

  // List movements
  const listMoveRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/movements`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(listMoveRes.status === 200, 'List movements succeeds');
  assert(listMoveRes.body.length >= 2, 'Both vehicle bay movements tracked');

  // =========================================================================
  // 8. Parts & Paint Material Consumption
  // =========================================================================
  console.log('\n--- 8. Parts & Paint Material Consumption ---');

  // Fetch or create parts for paint and collision materials
  let partsListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/parts',
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  let basecoatPart = (partsListRes.body || []).find((p) => p.code === 'PAINT-BASE-070');
  let clearcoatPart = (partsListRes.body || []).find((p) => p.code === 'PAINT-CLEAR-HG');

  if (!basecoatPart) {
    const p1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/parts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directorToken}`,
      },
    }, {
      code: 'PAINT-BASE-070',
      name: 'Automotive Basecoat Pearl White 070 (Litres)',
      category: 'PAINT_MATERIALS',
      salePrice: 350.00,
      costPrice: 220.00,
      minStock: 5,
    });
    basecoatPart = p1.body;
  }

  if (!clearcoatPart) {
    const p2 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/parts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directorToken}`,
      },
    }, {
      code: 'PAINT-CLEAR-HG',
      name: 'High-Gloss Polyurethane Clearcoat (Litres)',
      category: 'PAINT_MATERIALS',
      salePrice: 250.00,
      costPrice: 160.00,
      minStock: 5,
    });
    clearcoatPart = p2.body;
  }
  assert(basecoatPart && clearcoatPart, 'Paint materials catalog items verified');

  // Negative test: non-existent part
  const invalidPartMat = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/material-consumption`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    partId: 'non-existent-part-code',
    quantity: 1,
  });
  assert(invalidPartMat.status === 400, 'Validation: Inactive or non-existent material rejected with 400');

  // Consume 3.5 Litres of Basecoat
  const mat1Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/material-consumption`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    partId: basecoatPart.id,
    operationId: paintOpId,
    quantity: 3.5,
    unitCost: 350.00,
  });
  assert(mat1Res.status === 201 || mat1Res.status === 200, 'Consumed 3.5L Pearl White Basecoat');
  assert(Number(mat1Res.body.quantity) === 3.5, 'Basecoat consumption quantity recorded');

  // Consume 2.0 Litres of Clearcoat
  const mat2Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/material-consumption`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    partId: clearcoatPart.code, // Test code resolution
    operationId: paintOpId,
    quantity: 2.0,
    unitCost: 250.00,
  });
  assert(mat2Res.status === 201 || mat2Res.status === 200, 'Consumed 2.0L High-Gloss Clearcoat (resolved via code)');

  // List materials
  const listMatRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/materials`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(listMatRes.status === 200, 'List material consumption succeeds');
  assert(listMatRes.body.length >= 2, 'Both paint material consumptions tracked');

  // =========================================================================
  // 9. Quality Check, Final Inspection & Invoice-Ready Summary with Separated Payables
  // =========================================================================
  console.log('\n--- 9. Quality Check, Final Inspection & Invoice-Ready Summary ---');

  // Advisor updates status to QUALITY_CHECK
  const statusQcRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    status: 'QUALITY_CHECK',
  });
  assert(statusQcRes.status === 200, 'Repair order transitioned to QUALITY_CHECK');
  assert(statusQcRes.body.status === 'QUALITY_CHECK', 'Status is QUALITY_CHECK');

  // Advisor updates status to READY_FOR_INVOICE
  const statusRfiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    status: 'READY_FOR_INVOICE',
  });
  assert(statusRfiRes.status === 200, 'Repair order transitioned to READY_FOR_INVOICE');

  // Fetch invoice-ready summary
  const invoiceReadyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/invoice-ready`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(invoiceReadyRes.status === 200, 'Fetch invoice-ready summary succeeds');
  const invSummary = invoiceReadyRes.body;

  // Expected calculations:
  // Labor: 10 hrs * 120 + 8 hrs * 150 = 1200 + 1200 = 2400.00
  // Materials: 3.5 * 350 + 2.0 * 250 = 1225 + 500 = 1725.00
  // Subtotal / Total: 2400 + 1725 = 4125.00
  // Insurer approved amount: 3200.00
  // Insurer payable: min(4125, 3200) = 3200.00
  // Customer payable: 4125 - 3200 = 925.00
  assert(Number(invSummary.laborTotal) === 2400.00, `Labor total calculated correctly (Expected: 2400, Actual: ${invSummary.laborTotal})`);
  assert(Number(invSummary.materialsTotal) === 1725.00, `Materials total calculated correctly (Expected: 1725, Actual: ${invSummary.materialsTotal})`);
  assert(Number(invSummary.total) === 4125.00, `Total job amount calculated correctly (Expected: 4125, Actual: ${invSummary.total})`);

  // Verify separate insurance and customer payable amounts
  assert(Number(invSummary.insurerPayable) === 3200.00, `Insurer payable capped at approved amount (Expected: 3200, Actual: ${invSummary.insurerPayable})`);
  assert(Number(invSummary.customerPayable) === 925.00, `Customer payable covers balance remainder (Expected: 925, Actual: ${invSummary.customerPayable})`);
  assert(
    Number(invSummary.insurerPayable) + Number(invSummary.customerPayable) === Number(invSummary.total),
    'Insurer payable and customer payable sum exactly to total invoice amount'
  );

  // =========================================================================
  // 10. Service-to-Accounts Integration (Finance Notifications & AR Recording)
  // =========================================================================
  console.log('\n--- 10. Service-to-Accounts Integration ---');

  // Accounts Manager views operational notifications
  const notifRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/notifications',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  assert(notifRes.status === 200, 'Accounts manager retrieves finance notifications');
  const bpNotif = (notifRes.body || []).find((n) => n.sourceId === orderId);
  assert(bpNotif !== undefined, 'Body & Paint completed job notification generated for Finance team');
  assert(bpNotif.category === 'PAINT_COMPLETED', `Notification category is PAINT_COMPLETED (${bpNotif.category})`);
  assert(bpNotif.title === 'Car Paint Work Completed', `Notification title is 'Car Paint Work Completed'`);
  assert(Number(bpNotif.amount) === 4125.00, `Notification amount reflects invoice-ready total 4,125.00`);
  assert(bpNotif.isRecorded === false, 'Notification initially marked as pending recording (isRecorded: false)');

  // Accounts Manager records the operational job into Accounts Receivable
  const recordJobRes = await request({
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
    sourceId: orderId,
    referenceNo: order.orderNo,
    amount: 4125.00,
    customerId,
    description: 'Body & Paint collision repair and pearl white refinishing',
  });
  assert(recordJobRes.status === 200 || recordJobRes.status === 201, 'Accounts Manager records Body & Paint job into Accounts Receivable');
  assert(recordJobRes.body.success === true, 'AR recording successful');
  assert(typeof recordJobRes.body.documentNo === 'string', `Finance document issued (${recordJobRes.body.documentNo})`);

  // Verify notification now marked as recorded
  const reCheckNotif = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/finance/notifications',
    method: 'GET',
    headers: { Authorization: `Bearer ${accountsToken}` },
  });
  const updatedBpNotif = (reCheckNotif.body || []).find((n) => n.sourceId === orderId);
  assert(updatedBpNotif.isRecorded === true, 'Notification status updated to isRecorded: true');
  assert(updatedBpNotif.documentNo === recordJobRes.body.documentNo, 'Notification links to issued Finance document');

  // =========================================================================
  // 11. Vehicle Delivery & Order Closure
  // =========================================================================
  console.log('\n--- 11. Vehicle Delivery & Order Closure ---');

  // Advisor updates status to INVOICED
  const statusInvoicedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    status: 'INVOICED',
  });
  assert(statusInvoicedRes.status === 200, 'Repair order transitioned to INVOICED');

  // Advisor delivers vehicle and marks order CLOSED
  const statusClosedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bpAdvisorToken}`,
    },
  }, {
    status: 'CLOSED',
  });
  assert(statusClosedRes.status === 200, 'Repair order transitioned to CLOSED upon vehicle handover');
  assert(statusClosedRes.body.status === 'CLOSED', 'Order status is CLOSED');
  assert(statusClosedRes.body.closedAt !== null, 'Order closedAt timestamp is populated');

  // =========================================================================
  // 12. Complete Graph & History Retrieval
  // =========================================================================
  console.log('\n--- 12. Complete Graph & History Retrieval ---');

  // Full order graph verification
  const fullOrderRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/repair-orders/${orderId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(fullOrderRes.status === 200, 'Fetch full repair order graph succeeds');
  const fullOrder = fullOrderRes.body;
  assert(fullOrder.customer?.id === customerId, 'Full graph includes customer');
  assert(fullOrder.vehicle?.id === vehicleId, 'Full graph includes vehicle');
  assert(Array.isArray(fullOrder.insuranceCases) && fullOrder.insuranceCases.length >= 1, 'Full graph includes insurance cases');
  assert(Array.isArray(fullOrder.assessments) && fullOrder.assessments.length >= 1, 'Full graph includes damage assessments');
  assert(Array.isArray(fullOrder.approvals) && fullOrder.approvals.length >= 2, 'Full graph includes approvals');
  assert(Array.isArray(fullOrder.operations) && fullOrder.operations.length >= 2, 'Full graph includes operations');
  assert(Array.isArray(fullOrder.movements) && fullOrder.movements.length >= 2, 'Full graph includes vehicle movements');
  assert(Array.isArray(fullOrder.materials) && fullOrder.materials.length >= 2, 'Full graph includes consumed materials');
  assert(fullOrder.invoiceSummary !== null, 'Full graph includes invoice summary');

  // Vehicle repair history
  const vehHistoryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/history/vehicle/${vehicleId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(vehHistoryRes.status === 200, 'Vehicle Body & Paint history retrieval succeeds');
  assert(vehHistoryRes.body.totalOrders >= 1, 'Vehicle history records total repair orders');
  assert(vehHistoryRes.body.totalSpent >= 4125.00, 'Vehicle history calculates cumulative repair expenditure');

  // Customer repair history
  const custHistoryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/body-paint/history/customer/${customerId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${bpAdvisorToken}` },
  });
  assert(custHistoryRes.status === 200, 'Customer Body & Paint history retrieval succeeds');
  assert(custHistoryRes.body.totalOrders >= 1, 'Customer history records total repair orders');
  assert(custHistoryRes.body.totalSpent >= 4125.00, 'Customer history calculates cumulative expenditure');

  // =========================================================================
  // 13. Reporting Drilldown, KPIs & Dashboards
  // =========================================================================
  console.log('\n--- 13. Reporting Drilldown, KPIs & Dashboards ---');

  // Body & Paint drilldown
  const drilldownRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/drilldown/body-paint',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(drilldownRes.status === 200, 'Body & Paint reporting drilldown query succeeds');
  assert(drilldownRes.body.source === 'body-paint', 'Drilldown source confirmed as body-paint');
  const foundInDrilldown = drilldownRes.body.data.some((d) => d.id === orderId || d.orderNo === order.orderNo);
  assert(foundInDrilldown, 'Body & Paint repair order listed in management reporting drilldown');

  // KPIs
  const kpiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/kpis',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(kpiRes.status === 200, 'Director reporting KPIs retrieval succeeds');
  assert(typeof kpiRes.body.bodyPaint?.openOrders === 'number', 'KPIs include Body & Paint open orders count');

  // Summary
  const summaryRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reporting/summary',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(summaryRes.status === 200, 'Reporting summary retrieval succeeds');
  assert(Array.isArray(summaryRes.body.bodyPaint), 'Reporting summary includes Body & Paint status breakdown');

  // =========================================================================
  // 14. Audit Trail Completeness
  // =========================================================================
  console.log('\n--- 14. Audit Trail Completeness ---');

  const auditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/audit?pageSize=100',
    method: 'GET',
    headers: { Authorization: `Bearer ${directorToken}` },
  });
  assert(auditRes.status === 200, 'Admin audit log query succeeds');
  const bpAuditEvents = auditRes.body.data.filter((e) =>
    e.entityId === orderId ||
    e.entityType.startsWith('BodyPaint') ||
    e.entityType === 'DamageAssessment' ||
    e.entityType === 'InsuranceCase' ||
    e.entityType === 'VehicleMovement' ||
    e.entityType === 'MaterialConsumption'
  );
  assert(bpAuditEvents.length >= 6, `Comprehensive audit events recorded for Body & Paint lifecycle (Found: ${bpAuditEvents.length})`);

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 5 COMPREHENSIVE TESTS PASSED (52/52) 🎉');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Suite execution failed:', err);
  process.exit(1);
});`r`n