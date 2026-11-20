import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';

export interface ReportFilter {
  branchId?: string;
  from?: string;
  to?: string;
  period?: 'daily' | 'today' | 'monthly' | 'month' | 'annual' | 'year' | string;
  page?: number;
  pageSize?: number;
  status?: string;
  query?: string;
  format?: 'json' | 'csv';
  basis?: 'accrual' | 'cash';
}

function toCsv(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerRow = headers.map(escapeCell).join(',');
  const dataRows = rows.map((row) => headers.map((h) => escapeCell(row[h])).join(','));
  return [headerRow, ...dataRows].join('\r\n');
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  private dates(filter: ReportFilter, field: string) {
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (filter.period) {
      const now = new Date();
      if (filter.period === 'daily' || filter.period === 'today') {
        fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      } else if (filter.period === 'monthly' || filter.period === 'month') {
        fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      } else if (filter.period === 'annual' || filter.period === 'year') {
        fromDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        toDate = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
      }
    }

    if (filter.from) {
      fromDate = new Date(filter.from);
    }
    if (filter.to) {
      toDate = new Date(filter.to);
      if (filter.to.length <= 10) {
        toDate = new Date(filter.to + 'T23:59:59.999Z');
      }
    }

    if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
      throw new BadRequestException('Invalid date filter');
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('from must be before to');
    }

    return fromDate || toDate
      ? { [field]: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {};
  }

  private paging(filter: ReportFilter) {
    const page = Math.max(1, Math.floor(Number(filter.page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(filter.pageSize) || 25)));
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
  }

  private branch(filter: ReportFilter) {
    return filter.branchId ? { branchId: filter.branchId } : {};
  }

  private decimal(value: Prisma.Decimal | number | null | undefined) {
    return value == null ? 0 : Number(value);
  }

  async kpis(filter: ReportFilter) {
    const b = this.branch(filter);
    const d = this.dates(filter, 'createdAt');
    const [customers, bookings, jobs, bodyPaint, receivables, payables, expenses, stock, cashier] = await Promise.all([
      this.prisma.customer.count({ where: { ...b, ...d } }),
      this.prisma.booking.count({ where: { ...b, ...this.dates(filter, 'bookingDate') } }),
      this.prisma.jobCard.count({ where: { ...b, ...this.dates(filter, 'openedAt') } }),
      this.prisma.bodyPaintRepairOrder.count({ where: { ...b, ...this.dates(filter, 'openedAt') } }),
      this.prisma.receivable.aggregate({ _sum: { outstanding: true }, where: { document: { createdAt: d.createdAt } } }),
      this.prisma.payable.aggregate({ _sum: { outstanding: true }, where: { document: { createdAt: d.createdAt } } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { ...this.dates(filter, 'expenseDate') } }),
      this.prisma.stockBalance.aggregate({ _sum: { quantity: true }, where: { location: b } }),
      this.prisma.cashierTransaction.aggregate({
        _sum: { amount: true },
        where: { session: { ...b, ...this.dates(filter, 'openedAt') }, status: 'POSTED' },
      }),
    ]);

    return {
      filters: filter,
      sales: { customers, bookings },
      service: { openJobs: jobs },
      bodyPaint: { openOrders: bodyPaint },
      parts: { stockQuantity: this.decimal(stock._sum.quantity) },
      finance: {
        receivablesOutstanding: this.decimal(receivables._sum.outstanding),
        payablesOutstanding: this.decimal(payables._sum.outstanding),
        expenses: this.decimal(expenses._sum.amount),
      },
      cashier: { postedAmount: this.decimal(cashier._sum.amount) },
    };
  }

  async summary(filter: ReportFilter) {
    const b = this.branch(filter);
    const p = this.paging(filter);
    const [sales, service, bodyPaint, parts, finance, cashier] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { ...b, ...this.dates(filter, 'bookingDate') },
      }),
      this.prisma.jobCard.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { ...b, ...this.dates(filter, 'openedAt') },
      }),
      this.prisma.bodyPaintRepairOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { ...b, ...this.dates(filter, 'openedAt') },
      }),
      this.prisma.stockBalance.findMany({
        where: { location: b },
        select: { itemCode: true, quantity: true, location: { select: { branchId: true, code: true } } },
        orderBy: { quantity: 'asc' },
        skip: p.skip,
        take: p.take,
      }),
      this.prisma.expense.groupBy({
        by: ['status'],
        _sum: { amount: true },
        where: { ...this.dates(filter, 'expenseDate') },
      }),
      this.prisma.cashierSession.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { ...b, ...this.dates(filter, 'openedAt') },
      }),
    ]);

    return {
      sales,
      service,
      bodyPaint,
      parts: parts.map((x) => ({ ...x, quantity: this.decimal(x.quantity) })),
      finance: finance.map((x) => ({ status: x.status, amount: this.decimal(x._sum.amount) })),
      cashier,
    };
  }

  async drilldown(source: string, filter: ReportFilter) {
    const p = this.paging(filter);
    const b = this.branch(filter);
    const q = filter.query ? { contains: filter.query } : undefined;
    let data: any[];
    let total = 0;

    if (source === 'sales') {
      const where = { ...b, ...this.dates(filter, 'bookingDate'), ...(q ? { bookingNo: q } : {}) };
      [data, total] = await Promise.all([
        this.prisma.booking.findMany({
          where,
          orderBy: { bookingDate: 'desc' },
          skip: p.skip,
          take: p.take,
          select: { id: true, bookingNo: true, status: true, bookingDate: true, branchId: true },
        }),
        this.prisma.booking.count({ where }),
      ]);
    } else if (source === 'service') {
      const where = {
        ...b,
        ...this.dates(filter, 'openedAt'),
        ...(filter.status ? { status: filter.status as any } : {}),
      };
      [data, total] = await Promise.all([
        this.prisma.jobCard.findMany({
          where,
          orderBy: { openedAt: 'desc' },
          skip: p.skip,
          take: p.take,
          select: { id: true, jobNo: true, status: true, openedAt: true, branchId: true },
        }),
        this.prisma.jobCard.count({ where }),
      ]);
    } else if (source === 'body-paint') {
      const where = {
        ...b,
        ...this.dates(filter, 'openedAt'),
        ...(filter.status ? { status: filter.status as any } : {}),
      };
      [data, total] = await Promise.all([
        this.prisma.bodyPaintRepairOrder.findMany({
          where,
          orderBy: { openedAt: 'desc' },
          skip: p.skip,
          take: p.take,
          select: { id: true, orderNo: true, status: true, openedAt: true, branchId: true },
        }),
        this.prisma.bodyPaintRepairOrder.count({ where }),
      ]);
    } else if (source === 'parts') {
      const where = {
        location: b,
        ...(filter.query ? { itemCode: { contains: filter.query } } : {}),
      };
      [data, total] = await Promise.all([
        this.prisma.stockBalance.findMany({
          where,
          orderBy: { quantity: 'desc' },
          skip: p.skip,
          take: p.take,
          select: {
            id: true,
            itemCode: true,
            quantity: true,
            updatedAt: true,
            location: {
              select: { id: true, code: true, name: true, branchId: true },
            },
          },
        }),
        this.prisma.stockBalance.count({ where }),
      ]);
      data = data.map((x) => ({ ...x, quantity: this.decimal(x.quantity) }));
    } else if (source === 'finance') {
      const where = {
        ...this.dates(filter, 'expenseDate'),
        ...(filter.status ? { status: filter.status as any } : {}),
      };
      [data, total] = await Promise.all([
        this.prisma.expense.findMany({
          where,
          orderBy: { expenseDate: 'desc' },
          skip: p.skip,
          take: p.take,
          select: { id: true, description: true, amount: true, status: true, expenseDate: true },
        }),
        this.prisma.expense.count({ where }),
      ]);
      data = data.map((x) => ({ ...x, amount: this.decimal(x.amount) }));
    } else if (source === 'cashier') {
      const where = {
        session: { ...b, ...this.dates(filter, 'openedAt') },
        ...(filter.status ? { status: filter.status as any } : {}),
      };
      [data, total] = await Promise.all([
        this.prisma.cashierTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: p.skip,
          take: p.take,
          select: { id: true, type: true, status: true, amount: true, createdAt: true, sessionId: true },
        }),
        this.prisma.cashierTransaction.count({ where }),
      ]);
      data = data.map((x) => ({ ...x, amount: this.decimal(x.amount) }));
    } else if (source === 'audit') {
      const where = {
        ...this.dates(filter, 'createdAt'),
        ...(filter.status ? { action: filter.status } : {}),
        ...(filter.query ? { entityType: { contains: filter.query } } : {}),
      };
      [data, total] = await Promise.all([
        this.prisma.auditEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: p.skip,
          take: p.take,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            metadata: true,
            createdAt: true,
            actor: { select: { id: true, username: true } },
          },
        }),
        this.prisma.auditEvent.count({ where }),
      ]);
    } else {
      throw new BadRequestException('Unknown drill-down source');
    }

    return { source, page: p.page, pageSize: p.pageSize, total, data };
  }

  async profitability(filter: ReportFilter & { basis?: 'accrual' | 'cash' }) {
    const basis = filter.basis === 'cash' ? 'cash' : 'accrual';
    const b = this.branch(filter);
    const dCreated = this.dates(filter, 'createdAt');
    const dBooking = this.dates(filter, 'bookingDate');
    const dExpense = this.dates(filter, 'expenseDate');
    const dCashier = this.dates(filter, 'openedAt');

    const [bookingsCount, receivablesAgg, payablesAgg, cashierAgg, expensesAgg] = await Promise.all([
      this.prisma.booking.count({ where: { ...b, ...dBooking } }),
      this.prisma.receivable.aggregate({
        _sum: { amount: true, outstanding: true },
        where: { document: { ...dCreated } },
      }),
      this.prisma.payable.aggregate({
        _sum: { amount: true, outstanding: true },
        where: { document: { ...dCreated } },
      }),
      this.prisma.cashierTransaction.aggregate({
        _sum: { amount: true },
        where: { session: { ...b, ...dCashier }, status: 'POSTED' },
      }),
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: { ...dExpense, status: { in: ['APPROVED', 'POSTED'] } },
      }),
    ]);

    const invoicedSales = this.decimal(receivablesAgg._sum.amount);
    const outstandingReceivables = this.decimal(receivablesAgg._sum.outstanding);
    const directCosts = this.decimal(payablesAgg._sum.amount);
    const cashReceived = this.decimal(cashierAgg._sum.amount);
    const operatingExpenses = this.decimal(expensesAgg._sum.amount);

    const invoicedVsCashDifference = invoicedSales - cashReceived;
    const collectionsRate = invoicedSales > 0 ? (cashReceived / invoicedSales) * 100 : 0;

    const accrualRevenue = invoicedSales;
    const accrualGrossProfit = accrualRevenue - directCosts;
    const accrualGrossMargin = accrualRevenue > 0 ? (accrualGrossProfit / accrualRevenue) * 100 : 0;
    const accrualOperatingProfit = accrualRevenue - directCosts - operatingExpenses;
    const accrualOperatingMargin = accrualRevenue > 0 ? (accrualOperatingProfit / accrualRevenue) * 100 : 0;

    const cashRevenue = cashReceived;
    const cashGrossProfit = cashRevenue - directCosts;
    const cashGrossMargin = cashRevenue > 0 ? (cashGrossProfit / cashRevenue) * 100 : 0;
    const cashOperatingProfit = cashRevenue - directCosts - operatingExpenses;
    const cashOperatingMargin = cashRevenue > 0 ? (cashOperatingProfit / cashRevenue) * 100 : 0;

    const revenue = basis === 'cash' ? cashRevenue : accrualRevenue;
    const grossProfit = basis === 'cash' ? cashGrossProfit : accrualGrossProfit;
    const grossMarginPct = basis === 'cash' ? cashGrossMargin : accrualGrossMargin;
    const operatingProfit = basis === 'cash' ? cashOperatingProfit : accrualOperatingProfit;
    const operatingMarginPct = basis === 'cash' ? cashOperatingMargin : accrualOperatingMargin;

    return {
      filter,
      basis,
      bookingsCount,
      invoicedSales,
      cashReceived,
      outstandingReceivables,
      invoicedVsCashDifference,
      collectionsRate: Math.round(collectionsRate * 100) / 100,
      revenue,
      directCosts,
      grossProfit,
      grossMarginPct: Math.round(grossMarginPct * 100) / 100,
      operatingExpenses,
      operatingProfit,
      operatingMarginPct: Math.round(operatingMarginPct * 100) / 100,
      breakdown: {
        accrual: {
          revenue: accrualRevenue,
          directCosts,
          grossProfit: accrualGrossProfit,
          grossMarginPct: Math.round(accrualGrossMargin * 100) / 100,
          operatingExpenses,
          operatingProfit: accrualOperatingProfit,
          operatingMarginPct: Math.round(accrualOperatingMargin * 100) / 100,
        },
        cash: {
          revenue: cashRevenue,
          directCosts,
          grossProfit: cashGrossProfit,
          grossMarginPct: Math.round(cashGrossMargin * 100) / 100,
          operatingExpenses,
          operatingProfit: cashOperatingProfit,
          operatingMarginPct: Math.round(cashOperatingMargin * 100) / 100,
        },
      },
    };
  }

  async metadata() {
    return {
      generatedAt: new Date().toISOString(),
      filters: ['branchId', 'from', 'to', 'period', 'status', 'query', 'page', 'pageSize', 'basis', 'format'],
      sources: ['sales', 'service', 'body-paint', 'parts', 'finance', 'cashier', 'audit', 'profitability'],
      periods: ['daily', 'monthly', 'annual', 'custom'],
      bases: ['accrual', 'cash'],
      formats: ['json', 'csv'],
      maxPageSize: 100,
      format: 'JSON or CSV tabular export',
    };
  }

  async exportData(source: string, filter: ReportFilter) {
    if (source === 'profitability') {
      const prof = await this.profitability(filter);
      const rows = [
        { metric: 'Bookings Count', value: prof.bookingsCount },
        { metric: 'Invoiced Sales', value: prof.invoicedSales },
        { metric: 'Cash Received', value: prof.cashReceived },
        { metric: 'Outstanding Receivables', value: prof.outstandingReceivables },
        { metric: 'Invoiced vs Cash Difference', value: prof.invoicedVsCashDifference },
        { metric: 'Recognized Revenue', value: prof.revenue },
        { metric: 'Direct Costs', value: prof.directCosts },
        { metric: 'Gross Profit', value: prof.grossProfit },
        { metric: 'Gross Margin %', value: prof.grossMarginPct },
        { metric: 'Operating Expenses', value: prof.operatingExpenses },
        { metric: 'Operating Profit', value: prof.operatingProfit },
        { metric: 'Operating Margin %', value: prof.operatingMarginPct },
        { metric: 'Accounting Basis', value: prof.basis },
      ];
      if (filter.format === 'csv') {
        return {
          source,
          format: 'csv',
          filename: `profitability-export-${Date.now()}.csv`,
          total: rows.length,
          csv: toCsv(rows),
          data: rows,
        };
      }
      return { source, format: 'json', total: rows.length, data: rows };
    }

    const result = await this.drilldown(source, { ...filter, page: 1, pageSize: 100 });
    if (filter.format === 'csv') {
      const flatRows = result.data.map((r: any) => {
        const flat: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
            for (const [subK, subV] of Object.entries(v as any)) {
              flat[`${k}_${subK}`] = subV;
            }
          } else {
            flat[k] = v;
          }
        }
        return flat;
      });
      return {
        source,
        format: 'csv',
        filename: `${source}-export-${Date.now()}.csv`,
        total: result.total,
        csv: toCsv(flatRows),
        data: result.data,
      };
    }
    return { ...result, format: 'json' };
  }

  async users(filter: ReportFilter) {
    const p = this.paging(filter);
    const where = filter.query
      ? { OR: [{ username: { contains: filter.query } }, { email: { contains: filter.query } }] }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
          roles: { select: { role: { select: { id: true, name: true } } } },
        },
        orderBy: { username: 'asc' },
        skip: p.skip,
        take: p.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { ...p, total, data: rows.map((u) => ({ ...u, roles: u.roles.map((r) => r.role) })) };
  }

  roles() {
    return this.prisma.role
      .findMany({
        orderBy: { name: 'asc' },
        include: { permissions: { include: { permission: true } } },
      })
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissions: r.permissions.map((x) => x.permission.code),
        })),
      );
  }

  permissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  departments() {
    return this.prisma.department.findMany({
      orderBy: { code: 'asc' },
      include: { branches: { select: { id: true, code: true, name: true } } },
    });
  }

  async createDepartment(body: { code: string; name: string }, actorId: string) {
    const code = (body.code ?? '').trim().toUpperCase();
    const name = (body.name ?? '').trim();
    if (!code || !name) throw new BadRequestException('Department code and name are required');

    const existing = await this.prisma.department.findUnique({ where: { code } });
    if (existing) throw new BadRequestException(`Department code "${code}" already exists`);

    const dept = await this.prisma.department.create({
      data: { code, name },
      include: { branches: { select: { id: true, code: true, name: true } } },
    });

    await this.prisma.auditEvent.create({
      data: {
        actorId,
        action: 'CREATE_DEPARTMENT',
        entityType: 'Department',
        entityId: dept.id,
        metadata: { code, name },
      },
    });

    return dept;
  }

  async createUser(
    body: { username: string; email: string; password?: string; roleIds?: string[]; isActive?: boolean },
    actorId: string,
  ) {
    const username = (body.username ?? '').trim().toLowerCase();
    const email = (body.email ?? '').trim().toLowerCase();
    if (!username || !email) throw new BadRequestException('Username and email are required');
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      if (existing.username.toLowerCase() === username)
        throw new BadRequestException(`Username "${username}" is already taken`);
      throw new BadRequestException(`Email "${email}" is already registered`);
    }
    if (body.roleIds && body.roleIds.length > 0) {
      const rolesCount = await this.prisma.role.count({ where: { id: { in: body.roleIds } } });
      if (rolesCount !== new Set(body.roleIds).size)
        throw new BadRequestException('One or more selected roles do not exist');
    }
    const rawPassword = body.password?.trim();
    if (!rawPassword) throw new BadRequestException('Password is required');
    const passwordHash = await this.passwords.hash(rawPassword);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
          isActive: body.isActive !== undefined ? body.isActive : true,
        },
      });

      if (body.roleIds && body.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: body.roleIds.map((roleId) => ({ userId: user.id, roleId })),
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE_USER',
          entityType: 'User',
          entityId: user.id,
          metadata: { username, email, roleIds: body.roleIds, isActive: body.isActive },
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
          roles: { select: { role: { select: { id: true, name: true } } } },
        },
      });
    });

    if (!created) throw new NotFoundException('Failed to retrieve created user');
    return {
      ...created,
      roles: created.roles.map((r) => r.role),
    };
  }

  async updateUserAccess(id: string, body: { isActive?: boolean; roleIds?: string[] }, actorId: string) {
    if (id === actorId && body.isActive === false)
      throw new BadRequestException('You cannot deactivate your own account');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (body.roleIds) {
      const roles = await this.prisma.role.count({ where: { id: { in: body.roleIds } } });
      if (roles !== new Set(body.roleIds).size) throw new BadRequestException('Every role must exist');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      if (body.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (body.roleIds.length) {
          await tx.userRole.createMany({
            data: body.roleIds.map((roleId) => ({ userId: id, roleId })),
          });
        }
      }
      await tx.user.update({
        where: { id },
        data: body.isActive === undefined ? {} : { isActive: body.isActive },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'UPDATE_ACCESS',
          entityType: 'User',
          entityId: id,
          metadata: { isActive: body.isActive, roleIds: body.roleIds },
        },
      });
      return tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
          roles: { select: { role: { select: { id: true, name: true } } } },
        },
      });
    });
    return result ? { ...result, roles: result.roles.map((r) => r.role) } : null;
  }

  async audits(filter: ReportFilter) {
    const p = this.paging(filter);
    const where = {
      ...this.dates(filter, 'createdAt'),
      ...(filter.status ? { action: filter.status } : {}),
      ...(filter.query ? { entityType: { contains: filter.query } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
          actor: { select: { id: true, username: true } },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { ...p, total, data };
  }

  approvalRules() {
    return [
      {
        id: 'rule-service-estimate',
        department: 'Service',
        workflow: 'Estimate Approval',
        thresholdAmount: 1000.0,
        requiredRole: 'Service Manager',
        description: 'Customer estimates exceeding Rs. 100,000 require Service Manager review before dispatch.',
        status: 'ACTIVE',
      },
      {
        id: 'rule-finance-expense',
        department: 'Finance',
        workflow: 'Expense Disbursement',
        thresholdAmount: 50000.0,
        requiredRole: 'Finance Director',
        description: 'Operational expenses exceeding Rs. 50,000 require dual authorization prior to GL posting.',
        status: 'ACTIVE',
      },
      {
        id: 'rule-body-paint-supplement',
        department: 'Body & Paint',
        workflow: 'Supplemental Damage Approval',
        thresholdAmount: 1500.0,
        requiredRole: 'Bodyshop Manager',
        description: 'Supplemental repairs or insurer adjustments require Bodyshop Manager and insurance signoff.',
        status: 'ACTIVE',
      },
      {
        id: 'rule-cashier-reversal',
        department: 'Cashier Desk',
        workflow: 'Transaction Reversal',
        thresholdAmount: 0.0,
        requiredRole: 'Cashier Supervisor',
        description: 'All cashier transaction reversals and refund adjustments require supervisor authorization.',
        status: 'ACTIVE',
      },
    ];
  }

  async approvals(filter: ReportFilter) {
    const b = this.branch(filter);
    const [estimates, expenses, bodyPaint] = await Promise.all([
      this.prisma.estimate.findMany({
        where: { status: 'PENDING_APPROVAL', jobCard: b },
        include: { jobCard: { select: { jobNo: true, branchId: true } }, lines: true },
        take: 100,
      }),
      this.prisma.expense.findMany({
        where: { status: 'DRAFT' },
        include: { document: true, expenseAccount: { select: { code: true, name: true } } },
        take: 100,
      }),
      this.prisma.bodyPaintApproval.findMany({
        where: { status: 'PENDING', repairOrder: b },
        include: { repairOrder: { select: { orderNo: true, branchId: true } } },
        take: 100,
      }),
    ]);
    return { estimates, expenses, bodyPaint };
  }

  async decide(kind: string, id: string, decision: string, actorId: string, notes?: string) {
    const approved = decision === 'APPROVE';
    if (!approved && decision !== 'REJECT') throw new BadRequestException('decision must be APPROVE or REJECT');
    let result: any;
    let entityType = kind;

    if (kind === 'estimate') {
      const item = await this.prisma.estimate.findUnique({ where: { id } });
      if (!item || item.status !== 'PENDING_APPROVAL') throw new NotFoundException('Estimate approval not found');
      result = await this.prisma.estimate.update({
        where: { id },
        data: {
          status: approved ? 'APPROVED' : 'REJECTED',
          approvedAt: approved ? new Date() : null,
          approvedById: approved ? actorId : null,
        },
      });
    } else if (kind === 'expense') {
      const item = await this.prisma.expense.findUnique({ where: { id } });
      if (!item || item.status !== 'DRAFT') throw new NotFoundException('Expense approval not found');
      result = await this.prisma.expense.update({
        where: { id },
        data: {
          status: approved ? 'APPROVED' : 'REJECTED',
          approvedById: approved ? actorId : null,
        },
      });
    } else if (kind === 'body-paint') {
      const item = await this.prisma.bodyPaintApproval.findUnique({ where: { id } });
      if (!item || item.status !== 'PENDING') throw new NotFoundException('Body paint approval not found');
      result = await this.prisma.bodyPaintApproval.update({
        where: { id },
        data: {
          status: approved ? 'APPROVED' : 'REJECTED',
          approvedAt: approved ? new Date() : null,
          approvedBy: actorId,
          notes,
        },
      });
    } else {
      throw new BadRequestException('Unknown approval type');
    }

    await this.prisma.auditEvent.create({
      data: {
        actorId,
        action: approved ? 'APPROVE' : 'REJECT',
        entityType,
        entityId: id,
        metadata: notes ? { notes } : undefined,
      },
    });

    return result;
  }
}
