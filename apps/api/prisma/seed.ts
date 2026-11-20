import { PrismaClient, AccountType } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt.toString('hex')}$${derivedKey}`;
}

const permissionDefinitions = [
  ['finance.account.read', 'View chart of accounts'],
  ['finance.period.read', 'View fiscal periods'],
  ['finance.journal.create', 'Create journal drafts'],
  ['finance.journal.post', 'Post journal entries'],
  ['finance.journal.reverse', 'Reverse posted journal entries'],
  ['finance.receivable.read', 'View receivables'],
  ['finance.payable.read', 'View payables'],
  ['finance.expense.create', 'Create expenses'],
  ['finance.expense.approve', 'Approve expenses'],
  ['finance.expense.post', 'Post expenses'],
  ['finance.bank.transaction.create', 'Enter bank and cash transactions'],
  ['finance.reconciliation.create', 'Reconcile bank transactions'],
  ['finance.report.read', 'View finance reports'],
  ['inventory.stock.receive', 'Receive stock'],
  ['inventory.stock.issue', 'Issue stock'],
  ['parts.read', 'View parts catalog'],
  ['parts.manage', 'Manage parts catalog'],
  ['parts.supplier.read', 'View parts suppliers'],
  ['parts.supplier.manage', 'Manage parts suppliers'],
  ['parts.stock.read', 'View parts stock'],
  ['parts.stock.receive', 'Receive parts'],
  ['parts.stock.issue', 'Issue parts'],
  ['parts.stock.return', 'Return parts to stock'],
  ['audit.view', 'View audit events'],
  ['users.manage', 'Manage users and access'],
  ['sales.customer.read', 'View sales customers'],
  ['sales.customer.create', 'Create sales customers'],
  ['sales.vehicle.read', 'View sales vehicles'],
  ['sales.vehicle.create', 'Create sales vehicles'],
  ['sales.lead.read', 'View sales leads'],
  ['sales.lead.create', 'Create sales leads'],
  ['sales.booking.read', 'View sales bookings'],
  ['sales.booking.create', 'Create sales bookings'],
  ['sales.lead.activity.read', 'View lead follow-ups and communication history'],
  ['sales.lead.activity.create', 'Create lead follow-ups and notes'],
  ['sales.lead.activity.complete', 'Complete lead follow-ups'],
  ['sales.booking.update', 'Update booking statuses'],
  ['sales.booking.approve', 'Approve booking requests'],
  ['sales.booking.invoice.create', 'Create vehicle invoices'],
  ['sales.booking.invoice.read', 'View vehicle invoices'],
  ['sales.booking.invoice.post', 'Post vehicle invoices'],
  ['sales.booking.payment.read', 'View vehicle booking payments'],
  ['sales.booking.payment.create', 'Record vehicle booking payments'],
  ['sales.booking.delivery.create', 'Deliver allocated vehicles'],
  ['sales.booking.request.create', 'Request booking changes'],
  ['sales.booking.request.decide', 'Decide booking change requests'],
  ['sales.booking.document.read', 'View booking documents'],
  ['sales.booking.document.create', 'Register booking documents'],
  ['sales.report.read', 'View sales performance reports'],
  ['service.jobcard.read', 'View service job cards'],
  ['service.jobcard.create', 'Create service job cards'],
  ['service.estimate.create', 'Create service estimates'],
  ['service.estimate.approve', 'Approve service estimates'],
  ['service.assign', 'Assign service technicians'],
  ['service.parts.request', 'Request service parts'],
  ['service.labor.record', 'Record service labor'],
  ['service.status.update', 'Update service status'],
  ['service.inspection.record', 'Record service inspections'],
  ['service.invoice.read', 'View invoice-ready service summaries'],
  ['bodypaint.repair-order.read', 'View Body & Paint repair orders'],
  ['bodypaint.repair-order.create', 'Create Body & Paint repair orders'],
  ['bodypaint.insurance.manage', 'Manage Body & Paint insurance cases'],
  ['bodypaint.assessment.create', 'Record Body & Paint damage assessments'],
  ['bodypaint.approval.manage', 'Manage Body & Paint approvals'],
  ['bodypaint.operation.manage', 'Manage Body & Paint operations'],
  ['bodypaint.movement.manage', 'Record Body & Paint vehicle movements'],
  ['bodypaint.material.manage', 'Record Body & Paint material consumption'],
  ['bodypaint.status.update', 'Update Body & Paint repair order status'],
  ['bodypaint.invoice.read', 'View Body & Paint invoice-ready summaries'],
  ['cashier.session.open', 'Open cashier sessions'],
  ['cashier.session.close', 'Close cashier sessions'],
  ['cashier.session.read', 'View cashier sessions'],
  ['cashier.transaction.create', 'Record cashier cash movements'],
  ['cashier.receipt.create', 'Issue customer receipts'],
  ['cashier.voucher.create', 'Issue payment vouchers'],
  ['cashier.reversal.create', 'Reverse cashier transactions'],
  ['cashier.reconcile', 'Reconcile cashier sessions'],
  ['reporting.dashboard.read', 'View cross-module dashboard KPIs'],
  ['reporting.report.read', 'View operational reports and drill-downs'],
  ['reporting.export', 'Export report datasets'],
  ['approvals.inbox.read', 'View pending approval inbox'],
  ['approvals.decide', 'Approve or reject controlled requests'],
];

const roleDefinitions = [
  ['Director / Managing Director', 'Full dealership visibility and approval authority'],
  ['System Administrator', 'Technical configuration and user access administration'],
  ['Accounts Manager', 'Finance and accounting operations'],
  ['Cashier', 'Cash receipts, payments, and reconciliation'],
  ['Sales Manager', 'Showroom management, team bookings, and allocation approvals'],
  ['Salesperson', 'Assigned leads, customer follow-ups, and vehicle bookings'],
  ['Service Manager / Service Advisor', 'Mechanical workshop job cards, estimates, and customer delivery'],
  ['Body & Paint Manager / Advisor', 'Collision repair, insurance cases, and paint material tracking'],
  ['Parts Manager / Storekeeper', 'Parts receiving, issuing, and stock control'],
  ['Technician / Workshop Staff', 'Assigned repair tasks, labor recording, and quality inspection'],
];

const accountDefinitions: Array<[string, string, AccountType]> = [
  ['1000', 'Cash and Bank', AccountType.ASSET],
  ['1100', 'Accounts Receivable', AccountType.ASSET],
  ['1200', 'Parts Inventory', AccountType.ASSET],
  ['2000', 'Accounts Payable', AccountType.LIABILITY],
  ['3000', 'Owner Equity', AccountType.EQUITY],
  ['4000', 'Vehicle Sales Revenue', AccountType.REVENUE],
  ['4100', 'Service Revenue', AccountType.REVENUE],
  ['4200', 'Parts Revenue', AccountType.REVENUE],
  ['5000', 'Cost of Goods Sold', AccountType.EXPENSE],
  ['5100', 'Workshop Labor Cost', AccountType.EXPENSE],
  ['5200', 'General Operating Expenses', AccountType.EXPENSE],
];

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be set and contain at least 12 characters');
  }

  const branch = await prisma.branch.upsert({
    where: { code: 'GMF' },
    update: { name: 'Gateway Motors Faisalabad' },
    create: { code: 'GMF', name: 'Gateway Motors Faisalabad' },
  });

  const locations = await Promise.all([
    ['MAIN', 'Main Parts Store'],
    ['WORKSHOP', 'Mechanical Workshop Store'],
    ['BODYPAINT', 'Body & Paint Store'],
  ].map(([code, name]) => prisma.location.upsert({
    where: { branchId_code: { branchId: branch.id, code } },
    update: { name },
    create: { branchId: branch.id, code, name },
  })));

  const seededParts = [
    ['OIL-FILTER-001', 'Engine Oil Filter', 'EA'],
    ['BRAKE-PAD-F-001', 'Front Brake Pad Set', 'SET'],
  ];
  const seededCategories = [
    ['ENGINE', 'Engine & Lubrication'],
    ['BRAKES', 'Brake System'],
    ['BODY', 'Body & Exterior'],
    ['ELECTRICAL', 'Electrical & Lighting'],
  ];
  const categories = new Map<string, string>();
  for (const [code, name] of seededCategories) {
    const category = await prisma.partCategory.upsert({ where: { code }, update: { name, isActive: true }, create: { code, name } });
    categories.set(code, category.id);
  }
  for (const [code, name, unit] of seededParts) {
    await prisma.part.upsert({ where: { code }, update: { name, unit, isActive: true }, create: { code, name, unit, reorderLevel: 0, maxStockLevel: 100, categoryId: code.startsWith('BRAKE') ? categories.get('BRAKES') : categories.get('ENGINE') } });
  }
  await prisma.supplier.upsert({
    where: { code: 'SEED-OEM' },
    update: { name: 'Gateway OEM Parts Supplier', isActive: true },
    create: { code: 'SEED-OEM', name: 'Gateway OEM Parts Supplier', isActive: true },
  });

  const permissions = new Map<string, string>();
  for (const [code, description] of permissionDefinitions) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
    permissions.set(code, permission.id);
  }

  const roles = new Map<string, string>();
  for (const [name, description] of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
    roles.set(name, role.id);
  }

  const directorPermissions = [...permissions.keys()];
  const adminPermissions = ['audit.view', 'users.manage', 'reporting.dashboard.read', 'reporting.report.read', 'reporting.export', 'approvals.inbox.read', 'approvals.decide'];
  const accountsPermissions = [...permissionDefinitions.filter(([code]) => code.startsWith('finance.')).map(([code]) => code), 'sales.booking.read', 'sales.booking.invoice.read', 'sales.booking.invoice.post', 'sales.booking.payment.read', 'sales.booking.payment.create', 'cashier.session.read', 'reporting.dashboard.read', 'reporting.report.read', 'reporting.export'];
  const cashierPermissions = permissionDefinitions.filter(([code]) => code.startsWith('cashier.')).map(([code]) => code);
  const salesManagerPermissions = [...permissionDefinitions.filter(([code]) => code.startsWith('sales.')).map(([code]) => code), 'reporting.dashboard.read', 'reporting.report.read', 'reporting.export', 'approvals.inbox.read', 'approvals.decide'];
  const salespersonPermissions = ['sales.customer.read', 'sales.customer.create', 'sales.vehicle.read', 'sales.vehicle.create', 'sales.lead.read', 'sales.lead.create', 'sales.lead.activity.read', 'sales.lead.activity.create', 'sales.lead.activity.complete', 'sales.booking.read', 'sales.booking.create', 'sales.booking.update', 'sales.booking.payment.read', 'sales.booking.request.create', 'sales.booking.document.read', 'sales.booking.document.create', 'sales.report.read'];
  const serviceAdvisorPermissions = [...permissionDefinitions.filter(([code]) => code.startsWith('service.')).map(([code]) => code), 'sales.customer.read', 'sales.customer.create', 'sales.vehicle.read', 'sales.vehicle.create', 'parts.read', 'parts.stock.read', 'reporting.dashboard.read', 'reporting.report.read', 'approvals.inbox.read', 'approvals.decide'];
  const bodyPaintAdvisorPermissions = [...permissionDefinitions.filter(([code]) => code.startsWith('bodypaint.')).map(([code]) => code), 'sales.customer.read', 'sales.customer.create', 'sales.vehicle.read', 'sales.vehicle.create', 'parts.read', 'parts.stock.read', 'reporting.dashboard.read', 'reporting.report.read', 'approvals.inbox.read', 'approvals.decide'];
  const partsPermissions = ['inventory.stock.receive', 'inventory.stock.issue', 'parts.read', 'parts.manage', 'parts.supplier.read', 'parts.supplier.manage', 'parts.stock.read', 'parts.stock.receive', 'parts.stock.issue', 'parts.stock.return', 'reporting.report.read'];
  const technicianPermissions = ['service.jobcard.read', 'service.jobcard.create', 'sales.customer.read', 'sales.vehicle.read', 'service.labor.record', 'service.status.update', 'service.inspection.record', 'bodypaint.operation.manage'];

  const rolePermissionMap = new Map<string, string[]>([
    ['Director / Managing Director', directorPermissions],
    ['System Administrator', adminPermissions],
    ['Accounts Manager', accountsPermissions],
    ['Cashier', cashierPermissions],
    ['Sales Manager', salesManagerPermissions],
    ['Salesperson', salespersonPermissions],
    ['Service Manager / Service Advisor', serviceAdvisorPermissions],
    ['Body & Paint Manager / Advisor', bodyPaintAdvisorPermissions],
    ['Parts Manager / Storekeeper', partsPermissions],
    ['Technician / Workshop Staff', technicianPermissions],
  ]);

  for (const [roleName, codes] of rolePermissionMap) {
    for (const code of codes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roles.get(roleName)!, permissionId: permissions.get(code)! } },
        update: {},
        create: { roleId: roles.get(roleName)!, permissionId: permissions.get(code)! },
      });
    }
  }

  const department = await prisma.department.upsert({
    where: { code: 'ACCOUNTS' },
    update: { name: 'Accounts & Finance' },
    create: { code: 'ACCOUNTS', name: 'Accounts & Finance' },
  });

  const fiscalPeriod = await prisma.fiscalPeriod.upsert({
    where: { startsOn_endsOn: { startsOn: new Date('2026-01-01'), endsOn: new Date('2026-12-31') } },
    update: { name: 'FY 2026', status: 'OPEN' },
    create: { name: 'FY 2026', startsOn: new Date('2026-01-01'), endsOn: new Date('2026-12-31'), status: 'OPEN' },
  });

  for (const [code, name, type] of accountDefinitions) {
    await prisma.chartOfAccount.upsert({ where: { code }, update: { name, type, isActive: true }, create: { code, name, type } });
  }

  const seededUsers = [
    { username: 'director', email: 'director@gatewaymotors.local', roles: ['Director / Managing Director'] },
    { username: 'admin', email: 'admin@gatewaymotors.local', roles: ['System Administrator', 'Director / Managing Director'] },
    { username: 'accounts', email: 'accounts@gatewaymotors.local', roles: ['Accounts Manager'] },
    { username: 'cashier', email: 'cashier@gatewaymotors.local', roles: ['Cashier'] },
    { username: 'sales.manager', email: 'sales.manager@gatewaymotors.local', roles: ['Sales Manager'] },
    { username: 'salesperson', email: 'salesperson@gatewaymotors.local', roles: ['Salesperson'] },
    { username: 'service.advisor', email: 'service.advisor@gatewaymotors.local', roles: ['Service Manager / Service Advisor'] },
    { username: 'bodypaint.advisor', email: 'bodypaint.advisor@gatewaymotors.local', roles: ['Body & Paint Manager / Advisor'] },
    { username: 'parts.manager', email: 'parts.manager@gatewaymotors.local', roles: ['Parts Manager / Storekeeper'] },
    { username: 'technician', email: 'technician@gatewaymotors.local', roles: ['Technician / Workshop Staff'] },
  ];

  for (const item of seededUsers) {
    const user = await prisma.user.upsert({
      where: { username: item.username },
      update: { email: item.email, isActive: true, passwordHash: hashPassword(adminPassword) },
      create: { username: item.username, email: item.email, passwordHash: hashPassword(adminPassword), isActive: true },
    });

    for (const roleName of item.roles) {
      const roleId = roles.get(roleName);
      if (roleId) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId } },
          update: {},
          create: { userId: user.id, roleId },
        });
      }
    }
  }

  console.log(JSON.stringify({
    branch: branch.code,
    locations: locations.map((location) => location.code),
    department: department.code,
    fiscalPeriod: fiscalPeriod.name,
    accounts: accountDefinitions.length,
    usersSeeded: seededUsers.map((u) => ({ username: u.username, roles: u.roles })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
