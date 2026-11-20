import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostJournalEntryDto } from './dto/post-journal-entry.dto';
import {
  ClosePeriodDto,
  CreateAccountDto,
  CreateBankTransactionDto,
  CreateExpenseDto,
  CreatePeriodDto,
  ReconcileDto,
  RecordOperationalJobDto,
  ReopenPeriodDto,
  SettleDocumentDto,
} from './dto/finance-workflow.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts() {
    await this.syncUnpostedReceivables();
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { isActive: true },
      include: {
        journalLines: {
          where: { journalEntry: { status: { in: ['POSTED', 'REVERSED'] } } }
        }
      },
      orderBy: { code: 'asc' }
    });
    return accounts.map((account) => {
      const debit = account.journalLines.reduce((sum, line) => sum.plus(line.debit), new Prisma.Decimal(0));
      const credit = account.journalLines.reduce((sum, line) => sum.plus(line.credit), new Prisma.Decimal(0));
      const isDebitNormal = account.type === 'ASSET' || account.type === 'EXPENSE';
      const balance = isDebitNormal ? debit.minus(credit) : credit.minus(debit);
      return {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        parentId: account.parentId,
        isActive: account.isActive,
        balance: Number(balance)
      };
    });
  }
  listPeriods() { return this.prisma.fiscalPeriod.findMany({ orderBy: { startsOn: 'desc' }, include: { closeControl: true } }); }

  listReceivables(filter?: { customerId?: string; status?: string }) {
    const where: Prisma.ReceivableWhereInput = {};
    if (filter?.customerId) where.customerId = filter.customerId;
    if (filter?.status) where.status = filter.status as any;
    return this.prisma.receivable.findMany({
      where,
      include: { document: true, customer: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  listPayables(filter?: { supplierId?: string; status?: string }) {
    const where: Prisma.PayableWhereInput = {};
    if (filter?.supplierId) where.supplierId = filter.supplierId;
    if (filter?.status) where.status = filter.status as any;
    return this.prisma.payable.findMany({
      where,
      include: { document: true, supplier: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  listDepartments() {
    return this.prisma.department.findMany({
      include: { branches: true },
      orderBy: { name: 'asc' },
    });
  }

  listJournals() { return this.prisma.journalEntry.findMany({ include: { lines: true }, orderBy: { entryDate: 'desc' } }); }
  listExpenses() { return this.prisma.expense.findMany({ include: { document: true, expenseAccount: true }, orderBy: { expenseDate: 'desc' } }); }
  listBankTransactions() { return this.prisma.bankTransaction.findMany({ include: { document: true, account: true }, orderBy: { transactionDate: 'desc' } }); }
  listReconciliations() { return this.prisma.reconciliation.findMany({ include: { account: true, lines: true }, orderBy: { statementDate: 'desc' } }); }

  private validateLines(dto: PostJournalEntryDto) {
    if (!dto.lines?.length) throw new BadRequestException('At least two journal lines are required');
    let debitTotal = new Prisma.Decimal(0); let creditTotal = new Prisma.Decimal(0);
    for (const line of dto.lines) {
      const debit = new Prisma.Decimal(line.debit ?? 0); const credit = new Prisma.Decimal(line.credit ?? 0);
      if (debit.isNegative() || credit.isNegative() || (debit.isZero() && credit.isZero()) || (!debit.isZero() && !credit.isZero())) {
        throw new BadRequestException('Each journal line must contain either a positive debit or credit');
      }
      debitTotal = debitTotal.plus(debit); creditTotal = creditTotal.plus(credit);
    }
    if (!debitTotal.equals(creditTotal)) throw new BadRequestException('Journal entry debits and credits must balance');
    const entryDate = new Date(dto.entryDate);
    if (Number.isNaN(entryDate.getTime())) throw new BadRequestException('Invalid entry date');
    return entryDate;
  }

  async createJournalDraft(dto: PostJournalEntryDto, createdById?: string) {
    const entryDate = this.validateLines(dto);
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN', startsOn: { lte: entryDate }, endsOn: { gte: entryDate } } });
      if (!period) throw new BadRequestException('No open fiscal period covers the entry date');
      if (dto.sourceType && dto.sourceId) {
        const existing = await tx.journalEntry.findFirst({ where: { sourceType: dto.sourceType, sourceId: dto.sourceId, status: { in: ['DRAFT', 'POSTED'] } } });
        if (existing) throw new BadRequestException('A journal entry already exists for this source reference');
      }
      const accounts = await tx.chartOfAccount.findMany({ where: { id: { in: dto.lines.map((l) => l.accountId) }, isActive: true }, select: { id: true } });
      if (accounts.length !== new Set(dto.lines.map((l) => l.accountId)).size) throw new BadRequestException('Every account must exist and be active');
      const entry = await tx.journalEntry.create({ data: { fiscalPeriodId: period.id, entryDate, description: dto.description, sourceType: dto.sourceType, sourceId: dto.sourceId, createdById, lines: { create: dto.lines.map((line) => ({ accountId: line.accountId, debit: new Prisma.Decimal(line.debit ?? 0), credit: new Prisma.Decimal(line.credit ?? 0), description: line.description })) } }, include: { lines: true } });
      await tx.auditEvent.create({ data: { actorId: createdById, action: 'CREATE', entityType: 'JournalEntry', entityId: entry.id, metadata: { status: 'DRAFT' } } });
      return entry;
    });
  }

  async postJournalEntry(id: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({ where: { id }, include: { fiscalPeriod: true, lines: true } });
      if (!entry) throw new NotFoundException('Journal draft not found');
      if (entry.status !== 'DRAFT') throw new BadRequestException('Only journal drafts can be posted');
      if (entry.fiscalPeriod.status !== 'OPEN') throw new BadRequestException('Fiscal period is closed');
      const posted = await tx.journalEntry.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() }, include: { lines: true } });
      await tx.auditEvent.create({ data: { actorId, action: 'POST', entityType: 'JournalEntry', entityId: id, metadata: { sourceType: entry.sourceType, sourceId: entry.sourceId } } });
      return posted;
    });
  }

  async reverseJournalEntry(id: string, actorId: string, description?: string) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.journalEntry.findUnique({ where: { id }, include: { lines: true, fiscalPeriod: true } });
      if (!original || original.status !== 'POSTED') throw new BadRequestException('Only a posted journal can be reversed');
      if (original.fiscalPeriod.status !== 'OPEN') throw new BadRequestException('Fiscal period is closed');
      const reversal = await tx.journalEntry.create({ data: { fiscalPeriodId: original.fiscalPeriodId, entryDate: new Date(), description: description ?? `Reversal of ${original.description}`, sourceType: 'REVERSAL', sourceId: original.id, createdById: actorId, status: 'POSTED', postedAt: new Date(), reversalOfId: original.id, lines: { create: original.lines.map((line) => ({ accountId: line.accountId, debit: line.credit, credit: line.debit, description: 'Controlled reversal' })) } }, include: { lines: true } });
      await tx.journalEntry.update({ where: { id }, data: { status: 'REVERSED' } });
      await tx.auditEvent.create({ data: { actorId, action: 'REVERSE', entityType: 'JournalEntry', entityId: id, metadata: { reversalId: reversal.id } } });
      return reversal;
    });
  }

  async createExpense(dto: CreateExpenseDto, actorId: string) {
    const amount = new Prisma.Decimal(dto.amount);
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.chartOfAccount.findFirst({ where: { id: dto.expenseAccountId, isActive: true, type: 'EXPENSE' } });
      if (!account) throw new BadRequestException('Active expense account is required');
      const document = await tx.financeDocument.create({ data: { documentNo: `EXP-${Date.now()}`, type: 'EXPENSE', amount, sourceType: dto.sourceType, sourceId: dto.sourceId, createdById: actorId } });
      const expense = await tx.expense.create({ data: { documentId: document.id, expenseDate: new Date(dto.expenseDate), description: dto.description, amount, expenseAccountId: account.id } });
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'Expense', entityId: expense.id, metadata: { documentId: document.id } } });
      return expense;
    });
  }

  async approveExpense(id: string, actorId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { document: { select: { createdById: true } } },
    });
    if (!expense || expense.status !== 'DRAFT') throw new BadRequestException('Only draft expenses can be approved');
    if (expense.document?.createdById === actorId) {
      throw new BadRequestException('The requester cannot approve their own expense');
    }
    return this.prisma.$transaction(async (tx) => { const result = await tx.expense.update({ where: { id }, data: { status: 'APPROVED', approvedById: actorId } }); await tx.auditEvent.create({ data: { actorId, action: 'APPROVE', entityType: 'Expense', entityId: id } }); return result; });
  }

  async postExpense(id: string, actorId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id }, include: { document: true } });
    if (!expense || expense.status !== 'APPROVED') throw new BadRequestException('Only approved expenses can be posted');
    const cash = await this.prisma.chartOfAccount.findFirst({ where: { code: '1000', isActive: true } });
    if (!cash) throw new BadRequestException('Cash and Bank account (1000) is required');
    const journal = await this.createJournalDraft({ entryDate: expense.expenseDate.toISOString(), description: expense.description, sourceType: 'Expense', sourceId: id, lines: [{ accountId: expense.expenseAccountId, debit: Number(expense.amount), credit: 0 }, { accountId: cash.id, debit: 0, credit: Number(expense.amount) }] } as PostJournalEntryDto, actorId);
    await this.postJournalEntry(journal.id, actorId);
    await this.prisma.expense.update({ where: { id }, data: { status: 'POSTED', postedById: actorId } });
    await this.prisma.financeDocument.update({ where: { id: expense.documentId }, data: { journalEntryId: journal.id } });
    return this.prisma.expense.findUnique({ where: { id } });
  }

  async createBankTransaction(dto: CreateBankTransactionDto, actorId: string) {
    const account = await this.prisma.chartOfAccount.findFirst({ where: { id: dto.accountId, isActive: true } });
    if (!account) throw new BadRequestException('Active bank account is required');
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.financeDocument.create({ data: { documentNo: `BANK-${Date.now()}`, type: 'BANK_TRANSACTION', amount: new Prisma.Decimal(dto.amount), sourceType: dto.sourceType, sourceId: dto.sourceId, createdById: actorId } });
      const result = await tx.bankTransaction.create({ data: { documentId: document.id, accountId: dto.accountId, transactionDate: new Date(dto.transactionDate), type: dto.type as any, amount: new Prisma.Decimal(dto.amount), reference: dto.reference, createdById: actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'BankTransaction', entityId: result.id } }); return result;
    });
  }

  async reconcile(dto: ReconcileDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transactions = await tx.bankTransaction.findMany({ where: { id: { in: dto.bankTransactionIds }, accountId: dto.accountId, status: 'ENTERED' } });
      if (transactions.length !== dto.bankTransactionIds.length) throw new BadRequestException('All transactions must be unreconciled transactions for this account');
      const result = await tx.reconciliation.create({ data: { accountId: dto.accountId, statementDate: new Date(dto.statementDate), statementBalance: new Prisma.Decimal(dto.statementBalance), status: 'COMPLETED', createdById: actorId, lines: { create: dto.bankTransactionIds.map((bankTransactionId) => ({ bankTransactionId })) } }, include: { lines: true } });
      await tx.bankTransaction.updateMany({ where: { id: { in: dto.bankTransactionIds } }, data: { status: 'RECONCILED' } });
      await tx.auditEvent.create({ data: { actorId, action: 'RECONCILE', entityType: 'Reconciliation', entityId: result.id } }); return result;
    });
  }

  async trialBalance() {
    await this.syncUnpostedReceivables();
    const accounts = await this.prisma.chartOfAccount.findMany({ include: { journalLines: { where: { journalEntry: { status: { in: ['POSTED', 'REVERSED'] } } } } }, orderBy: { code: 'asc' } });
    return accounts.map((account) => ({ ...account, debit: account.journalLines.reduce((sum, line) => sum.plus(line.debit), new Prisma.Decimal(0)), credit: account.journalLines.reduce((sum, line) => sum.plus(line.credit), new Prisma.Decimal(0)) }));
  }

  async ledger(accountId: string) {
    const account = await this.prisma.chartOfAccount.findUnique({ where: { id: accountId }, include: { journalLines: { where: { journalEntry: { status: { in: ['POSTED', 'REVERSED'] } } }, include: { journalEntry: true }, orderBy: { journalEntry: { entryDate: 'asc' } } } } });
    if (!account) throw new NotFoundException('Account not found');
    let balance = new Prisma.Decimal(0);
    return { account: { id: account.id, code: account.code, name: account.name }, lines: account.journalLines.map((line) => { balance = balance.plus(line.debit).minus(line.credit); return { ...line, balance }; }) };
  }

  async listOperationalNotifications(department?: string, category?: string) {
    const deptUpper = department ? department.toUpperCase() : undefined;
    const catUpper = category ? category.toUpperCase() : undefined;

    const includeBp =
      !deptUpper && !catUpper
        ? true
        : deptUpper === 'BODY_PAINT' || deptUpper === 'PAINT' || (catUpper && (catUpper.includes('PAINT') || catUpper.includes('BODY')));
    const includeJc =
      !deptUpper && !catUpper
        ? true
        : deptUpper === 'SERVICE' || deptUpper === 'WORKSHOP' || (catUpper && catUpper.includes('SERVICE'));
    const includeBk =
      !deptUpper && !catUpper
        ? true
        : deptUpper === 'SALES' || (catUpper && (catUpper.includes('SALE') || catUpper.includes('BOOKING')));

    const [bpOrders, jobCards, bookings, recordedDocs] = await Promise.all([
      includeBp
        ? this.prisma.bodyPaintRepairOrder.findMany({
            include: {
              customer: true,
              vehicle: true,
              operations: true,
              materials: true,
              invoiceSummary: true,
              assessments: true,
            },
            orderBy: { openedAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
      includeJc
        ? this.prisma.jobCard.findMany({
            include: {
              customer: true,
              vehicle: true,
              estimates: { include: { lines: true } },
              invoices: true,
              labor: true,
            },
            orderBy: { openedAt: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
      includeBk
        ? this.prisma.booking.findMany({
            include: {
              customer: true,
              vehicle: true,
            },
            orderBy: { bookingDate: 'desc' },
            take: 50,
          })
        : Promise.resolve([]),
      this.prisma.financeDocument.findMany({
        where: {
          sourceType: {
            in: ['BODY_PAINT_REPAIR_ORDER', 'JOB_CARD', 'VEHICLE_BOOKING'],
          },
        },
        include: {
          receivable: true,
        },
      }),
    ]);

    const recordedMap = new Map<string, { documentNo: string; receivableId?: string }>();
    for (const doc of recordedDocs) {
      if (doc.sourceType && doc.sourceId) {
        recordedMap.set(`${doc.sourceType}:${doc.sourceId}`, {
          documentNo: doc.documentNo,
          receivableId: doc.receivable?.id,
        });
      }
    }

    const notifications: Array<{
      id: string;
      sourceType: string;
      sourceId: string;
      department: 'BODY_PAINT' | 'SERVICE' | 'SALES';
      departmentLabel: string;
      category: 'PAINT_COMPLETED' | 'BODY_REPAIR_COMPLETED' | 'SERVICE_COMPLETED' | 'VEHICLE_SALE_CONFIRMED';
      title: string;
      message: string;
      referenceNo: string;
      customerName: string;
      customerId?: string;
      vehicleName: string;
      amount: number;
      date: string;
      status: string;
      isRecorded: boolean;
      documentNo?: string;
    }> = [];

    for (const order of bpOrders) {
      const isPaint = order.operations.some((op) => op.type === 'PAINT') || /paint/i.test(order.complaint || '');
      let amount = 0;
      if (order.invoiceSummary && Number(order.invoiceSummary.total) > 0) {
        amount = Number(order.invoiceSummary.total);
      } else {
        const laborSum = order.operations.reduce((sum, op) => sum + Number(op.hours) * Number(op.rate), 0);
        const matSum = order.materials.reduce((sum, m) => sum + Number(m.quantity) * Number(m.unitCost), 0);
        const estSum = order.assessments.reduce((sum, a) => sum + Number(a.estimatedLabor) + Number(a.estimatedMaterials), 0);
        amount = laborSum + matSum > 0 ? laborSum + matSum : estSum > 0 ? estSum : 650;
      }

      const vehicleName = [order.vehicle.modelYear, order.vehicle.make, order.vehicle.model].filter(Boolean).join(' ') || order.vehicle.registrationNo || 'Vehicle';
      const customerName = order.customer.name;
      const recorded = recordedMap.get(`BODY_PAINT_REPAIR_ORDER:${order.id}`);

      notifications.push({
        id: `bp-${order.id}`,
        sourceType: 'BODY_PAINT_REPAIR_ORDER',
        sourceId: order.id,
        department: 'BODY_PAINT',
        departmentLabel: 'Body & Paint',
        category: isPaint ? 'PAINT_COMPLETED' : 'BODY_REPAIR_COMPLETED',
        title: isPaint ? 'Car Paint Work Completed' : 'Body Repair Completed',
        message: `${isPaint ? 'Paint refinishing & coating' : 'Body repair work'} (${order.orderNo}) for ${vehicleName} · ${customerName} completed. Ready for financial entry.`,
        referenceNo: order.orderNo,
        customerName,
        customerId: order.customerId,
        vehicleName,
        amount,
        date: order.openedAt.toISOString(),
        status: order.status,
        isRecorded: !!recorded,
        documentNo: recorded?.documentNo,
      });
    }

    for (const jc of jobCards) {
      let amount = 0;
      if (jc.invoices?.[0] && Number(jc.invoices[0].total) > 0) {
        amount = Number(jc.invoices[0].total);
      } else if (jc.estimates?.[0]?.lines?.length) {
        amount = jc.estimates[0].lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0);
      } else if (jc.labor?.length) {
        amount = jc.labor.reduce((sum, l) => sum + Number(l.hours) * Number(l.rate), 0);
      } else {
        amount = 320;
      }

      const vehicleName = [jc.vehicle.modelYear, jc.vehicle.make, jc.vehicle.model].filter(Boolean).join(' ') || jc.vehicle.registrationNo || 'Vehicle';
      const customerName = jc.customer.name;
      const recorded = recordedMap.get(`JOB_CARD:${jc.id}`);

      notifications.push({
        id: `jc-${jc.id}`,
        sourceType: 'JOB_CARD',
        sourceId: jc.id,
        department: 'SERVICE',
        departmentLabel: 'Workshop / Service',
        category: 'SERVICE_COMPLETED',
        title: 'Mechanical Workshop Service Completed',
        message: `Workshop job card (${jc.jobNo}) for ${vehicleName} · ${customerName} completed. Ready for billing.`,
        referenceNo: jc.jobNo,
        customerName,
        customerId: jc.customerId,
        vehicleName,
        amount,
        date: jc.openedAt.toISOString(),
        status: jc.status,
        isRecorded: !!recorded,
        documentNo: recorded?.documentNo,
      });
    }

    for (const bk of bookings) {
      let amount = 25000;
      if (bk.vehicle?.sourceId && /^\d+(\.\d+)?$/.test(String(bk.vehicle.sourceId))) {
        amount = Number(bk.vehicle.sourceId);
      }
      const vehicleName = bk.vehicle ? [bk.vehicle.modelYear, bk.vehicle.make, bk.vehicle.model].filter(Boolean).join(' ') || bk.vehicle.registrationNo || 'Vehicle' : 'Vehicle';
      const customerName = bk.customer?.name || 'Customer';
      const recorded = recordedMap.get(`VEHICLE_BOOKING:${bk.id}`);

      notifications.push({
        id: `bk-${bk.id}`,
        sourceType: 'VEHICLE_BOOKING',
        sourceId: bk.id,
        department: 'SALES',
        departmentLabel: 'Vehicle Sales',
        category: 'VEHICLE_SALE_CONFIRMED',
        title: 'Vehicle Sales Order Confirmed',
        message: `Sale booking (${bk.bookingNo}) for ${vehicleName} · ${customerName} confirmed. Ready to record in finance.`,
        referenceNo: bk.bookingNo,
        customerName,
        customerId: bk.customerId || undefined,
        vehicleName,
        amount,
        date: bk.bookingDate.toISOString(),
        status: bk.status,
        isRecorded: !!recorded,
        documentNo: recorded?.documentNo,
      });
    }

    notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return notifications;
  }

  async recordOperationalJobAsReceivable(dto: RecordOperationalJobDto, actorId: string) {
    const amount = new Prisma.Decimal(dto.amount);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.financeDocument.findFirst({
        where: { sourceType: dto.sourceType, sourceId: dto.sourceId },
        include: { receivable: true },
      });
      if (existing) {
        return { success: true, documentNo: existing.documentNo, receivableId: existing.receivable?.id, alreadyRecorded: true };
      }

      let customerId = dto.customerId;
      if (customerId) {
        const cust = await tx.customer.findUnique({ where: { id: customerId } });
        if (!cust) customerId = undefined;
      }
      if (!customerId) {
        const defaultCust = await tx.customer.findFirst();
        customerId = defaultCust?.id;
      }

      const documentNo = `REC-${Date.now().toString().slice(-6)}`;
      const document = await tx.financeDocument.create({
        data: {
          documentNo,
          type: 'RECEIVABLE',
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          amount,
          createdById: actorId,
        },
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const receivable = await tx.receivable.create({
        data: {
          documentId: document.id,
          customerId,
          dueDate,
          amount,
          outstanding: amount,
          status: 'OPEN',
        },
      });

      // Balanced double-entry GL journal posting: Debit 1100 AR, Credit 4000/4100 Revenue
      const arAccount = await tx.chartOfAccount.findUnique({ where: { code: '1100' } });
      const revAccountCode = dto.sourceType === 'VEHICLE_BOOKING' ? '4000' : '4100';
      let revAccount = await tx.chartOfAccount.findUnique({ where: { code: revAccountCode } });
      if (!revAccount) {
        revAccount = await tx.chartOfAccount.findFirst({ where: { type: 'REVENUE', isActive: true } });
      }
      const period = await tx.fiscalPeriod.findFirst({
        where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } },
      }) || await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startsOn: 'desc' } });

      let journalEntryId: string | undefined;
      if (arAccount && revAccount && period && amount.gt(0)) {
        const journal = await tx.journalEntry.create({
          data: {
            fiscalPeriodId: period.id,
            entryDate: new Date(),
            description: `Receivable invoice for ${dto.sourceType}: ${dto.referenceNo || documentNo}`,
            sourceType: dto.sourceType,
            sourceId: receivable.id,
            status: 'POSTED',
            postedAt: new Date(),
            createdById: actorId,
            lines: {
              create: [
                { accountId: arAccount.id, debit: amount, credit: 0, description: `AR for ${dto.referenceNo || documentNo}` },
                { accountId: revAccount.id, debit: 0, credit: amount, description: `Revenue for ${dto.referenceNo || documentNo}` },
              ],
            },
          },
        });
        journalEntryId = journal.id;
        if (tx.financeDocument?.update) {
          await tx.financeDocument.update({
            where: { id: document.id },
            data: { journalEntryId },
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Receivable',
          entityId: receivable.id,
          metadata: {
            sourceType: dto.sourceType,
            sourceId: dto.sourceId,
            referenceNo: dto.referenceNo,
            description: dto.description,
            amount: dto.amount,
            journalEntryId,
          },
        },
      });

      return {
        success: true,
        documentNo,
        receivableId: receivable.id,
        journalEntryId,
      };
    });
  }

  async syncUnpostedReceivables(actorId?: string) {
    try {
      const unpostedDocs = await this.prisma.financeDocument.findMany({
        where: {
          type: 'RECEIVABLE',
          journalEntryId: null,
        },
        include: {
          receivable: true,
        },
      });
      if (unpostedDocs.length === 0) return 0;

      const [arAccount, revSales, revService, openPeriod] = await Promise.all([
        this.prisma.chartOfAccount.findUnique({ where: { code: '1100' } }),
        this.prisma.chartOfAccount.findUnique({ where: { code: '4000' } }),
        this.prisma.chartOfAccount.findUnique({ where: { code: '4100' } }),
        this.prisma.fiscalPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startsOn: 'desc' } }),
      ]);

      if (!arAccount || !openPeriod) return 0;

      let count = 0;
      for (const doc of unpostedDocs) {
        if (!doc.receivable) continue;
        const revAccount = doc.sourceType === 'VEHICLE_BOOKING' ? (revSales || revService) : (revService || revSales);
        if (!revAccount) continue;

        try {
          const journal = await this.prisma.journalEntry.create({
            data: {
              fiscalPeriodId: openPeriod.id,
              entryDate: doc.createdAt,
              description: `Receivable invoice for ${doc.sourceType}: ${doc.documentNo}`,
              sourceType: doc.sourceType || 'RECEIVABLE',
              sourceId: doc.receivable.id,
              status: 'POSTED',
              postedAt: doc.createdAt,
              createdById: doc.createdById || actorId,
              lines: {
                create: [
                  { accountId: arAccount.id, debit: doc.amount, credit: 0, description: `AR for ${doc.documentNo}` },
                  { accountId: revAccount.id, debit: 0, credit: doc.amount, description: `Revenue for ${doc.documentNo}` },
                ],
              },
            },
          });
          await this.prisma.financeDocument.update({
            where: { id: doc.id },
            data: { journalEntryId: journal.id },
          });
          count++;
        } catch {
          // ignore duplicate / constraint conflicts on concurrent syncs
        }
      }
      return count;
    } catch {
      return 0;
    }
  }

  async createAccount(dto: CreateAccountDto, actorId: string) {
    const code = dto.code.trim();
    const existing = await this.prisma.chartOfAccount.findUnique({ where: { code } });
    if (existing) throw new BadRequestException(`Chart of account code ${code} already exists`);
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.chartOfAccount.create({
        data: {
          code,
          name: dto.name.trim(),
          type: dto.type,
          parentId: dto.parentId,
          isActive: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'ChartOfAccount',
          entityId: account.id,
          metadata: { code, name: dto.name, type: dto.type },
        },
      });
      return {
        ...account,
        balance: 0,
      };
    });
  }

  async createPeriod(dto: CreatePeriodDto, actorId: string) {
    const startsOn = new Date(dto.startsOn);
    const endsOn = new Date(dto.endsOn);
    if (isNaN(startsOn.getTime()) || isNaN(endsOn.getTime())) {
      throw new BadRequestException('Invalid date format for fiscal period');
    }
    if (startsOn >= endsOn) {
      throw new BadRequestException('startsOn must be strictly before endsOn');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.fiscalPeriod.findUnique({
        where: { startsOn_endsOn: { startsOn, endsOn } },
      });
      if (existing) throw new BadRequestException('A fiscal period for these dates already exists');
      const period = await tx.fiscalPeriod.create({
        data: {
          name: dto.name.trim(),
          startsOn,
          endsOn,
          status: 'OPEN',
        },
        include: { closeControl: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'FiscalPeriod',
          entityId: period.id,
          metadata: { name: dto.name, startsOn: dto.startsOn, endsOn: dto.endsOn },
        },
      });
      return period;
    });
  }

  async closePeriod(id: string, dto: ClosePeriodDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findUnique({
        where: { id },
        include: { closeControl: true },
      });
      if (!period) throw new NotFoundException('Fiscal period not found');
      if (period.status !== 'OPEN') {
        throw new BadRequestException('Fiscal period is already closed');
      }
      const updated = await tx.fiscalPeriod.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedById: actorId,
        },
      });
      const checklist = (dto.checklist && dto.checklist.length > 0
        ? dto.checklist
        : [
            'Bank feed imported & reconciled',
            'Expense claims cleared',
            'Workshop service & paint billing completed',
            'Parts inventory balanced',
            'Trial balance agrees',
            'Period review sign-off completed',
          ]) as Prisma.InputJsonValue;

      const closeControl = await tx.fiscalPeriodCloseControl.upsert({
        where: { fiscalPeriodId: id },
        update: {
          checklist,
          closedById: actorId,
          closedAt: new Date(),
        },
        create: {
          fiscalPeriodId: id,
          checklist,
          closedById: actorId,
          closedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CLOSE',
          entityType: 'FiscalPeriod',
          entityId: id,
          metadata: { periodName: period.name, checklist: dto.checklist },
        },
      });
      return {
        ...updated,
        closeControl,
      };
    });
  }

  async reopenPeriod(id: string, dto: ReopenPeriodDto | undefined, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findUnique({
        where: { id },
        include: { closeControl: true },
      });
      if (!period) throw new NotFoundException('Fiscal period not found');
      if (period.status === 'OPEN') {
        throw new BadRequestException('Fiscal period is already open');
      }
      const updated = await tx.fiscalPeriod.update({
        where: { id },
        data: {
          status: 'OPEN',
          closedAt: null,
          closedById: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'REOPEN',
          entityType: 'FiscalPeriod',
          entityId: id,
          metadata: { reason: dto?.reason, periodName: period.name },
        },
      });
      return updated;
    });
  }

  async settleReceivable(id: string, dto: SettleDocumentDto, actorId: string) {
    const settleAmount = new Prisma.Decimal(dto.amount);
    if (settleAmount.lte(0)) throw new BadRequestException('Settlement amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const receivable = await tx.receivable.findUnique({
        where: { id },
        include: { document: true, customer: true },
      });
      if (!receivable) throw new NotFoundException('Receivable not found');
      if (receivable.status === 'PAID' || receivable.status === 'VOID') {
        throw new BadRequestException('Receivable is already paid or void');
      }
      if (settleAmount.gt(receivable.outstanding)) {
        throw new BadRequestException(`Settlement amount cannot exceed outstanding balance of ${receivable.outstanding}`);
      }

      const newOutstanding = receivable.outstanding.minus(settleAmount);
      const newStatus = newOutstanding.isZero() ? 'PAID' : 'PARTIALLY_PAID';

      const updatedReceivable = await tx.receivable.update({
        where: { id },
        data: {
          outstanding: newOutstanding,
          status: newStatus,
        },
        include: { document: true, customer: true },
      });
      if (updatedReceivable.document.sourceType === 'BODY_PAINT_CUSTOMER' || updatedReceivable.document.sourceType === 'BODY_PAINT_INSURER') {
        const bodyPaintReceivables = await tx.receivable.findMany({ where: { document: { sourceId: updatedReceivable.document.sourceId, sourceType: { in: ['BODY_PAINT_CUSTOMER', 'BODY_PAINT_INSURER'] } } } });
        if (bodyPaintReceivables.length > 0 && bodyPaintReceivables.every((item) => item.outstanding.isZero())) {
          await tx.bodyPaintInvoice.update({ where: { id: updatedReceivable.document.sourceId! }, data: { status: 'PAID' } });
        }
      }

      // Post General Ledger journal entry for the receipt
      const cashAccount = await tx.chartOfAccount.findFirst({
        where: dto.bankAccountId ? { id: dto.bankAccountId, isActive: true } : { code: '1000', isActive: true },
      });
      const arAccount = await tx.chartOfAccount.findFirst({
        where: { code: '1100', isActive: true },
      });
      const period = await tx.fiscalPeriod.findFirst({
        where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } },
      });

      let journalEntryId: string | undefined;
      if (cashAccount && arAccount && period) {
        const journal = await tx.journalEntry.create({
          data: {
            fiscalPeriodId: period.id,
            entryDate: new Date(),
            description: `Payment received for ${receivable.document.documentNo} - ${receivable.customer?.name || 'Customer'}`,
            sourceType: 'RECEIVABLE_SETTLEMENT',
            sourceId: receivable.id,
            createdById: actorId,
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: [
                { accountId: cashAccount.id, debit: settleAmount, credit: 0, description: `Receipt on ${receivable.document.documentNo}` },
                { accountId: arAccount.id, debit: 0, credit: settleAmount, description: `AR credit on ${receivable.document.documentNo}` },
              ],
            },
          },
        });
        journalEntryId = journal.id;
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'SETTLE',
          entityType: 'Receivable',
          entityId: id,
          metadata: {
            amount: dto.amount,
            newOutstanding: Number(newOutstanding),
            newStatus,
            journalEntryId,
            reference: dto.reference,
          },
        },
      });

      return {
        success: true,
        receivable: updatedReceivable,
        settledAmount: Number(settleAmount),
        outstanding: Number(newOutstanding),
        status: newStatus,
        journalEntryId,
      };
    });
  }

  async settlePayable(id: string, dto: SettleDocumentDto, actorId: string) {
    const settleAmount = new Prisma.Decimal(dto.amount);
    if (settleAmount.lte(0)) throw new BadRequestException('Settlement amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const payable = await tx.payable.findUnique({
        where: { id },
        include: { document: true, supplier: true },
      });
      if (!payable) throw new NotFoundException('Payable not found');
      if (payable.status === 'PAID' || payable.status === 'VOID') {
        throw new BadRequestException('Payable is already paid or void');
      }
      if (settleAmount.gt(payable.outstanding)) {
        throw new BadRequestException(`Settlement amount cannot exceed outstanding balance of ${payable.outstanding}`);
      }

      const newOutstanding = payable.outstanding.minus(settleAmount);
      const newStatus = newOutstanding.isZero() ? 'PAID' : 'PARTIALLY_PAID';

      const updatedPayable = await tx.payable.update({
        where: { id },
        data: {
          outstanding: newOutstanding,
          status: newStatus,
        },
        include: { document: true, supplier: true },
      });

      // Post General Ledger journal entry for the payment
      const cashAccount = await tx.chartOfAccount.findFirst({
        where: dto.bankAccountId ? { id: dto.bankAccountId, isActive: true } : { code: '1000', isActive: true },
      });
      const apAccount = await tx.chartOfAccount.findFirst({
        where: { code: '2000', isActive: true },
      });
      const period = await tx.fiscalPeriod.findFirst({
        where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } },
      });

      let journalEntryId: string | undefined;
      if (cashAccount && apAccount && period) {
        const journal = await tx.journalEntry.create({
          data: {
            fiscalPeriodId: period.id,
            entryDate: new Date(),
            description: `Payment to supplier ${payable.supplier?.name || 'Supplier'} - ${payable.document.documentNo}`,
            sourceType: 'PAYABLE_SETTLEMENT',
            sourceId: payable.id,
            createdById: actorId,
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: [
                { accountId: apAccount.id, debit: settleAmount, credit: 0, description: `AP debit on ${payable.document.documentNo}` },
                { accountId: cashAccount.id, debit: 0, credit: settleAmount, description: `Cash disbursement on ${payable.document.documentNo}` },
              ],
            },
          },
        });
        journalEntryId = journal.id;
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'SETTLE',
          entityType: 'Payable',
          entityId: id,
          metadata: {
            amount: dto.amount,
            newOutstanding: Number(newOutstanding),
            newStatus,
            journalEntryId,
            reference: dto.reference,
          },
        },
      });

      return {
        success: true,
        payable: updatedPayable,
        settledAmount: Number(settleAmount),
        outstanding: Number(newOutstanding),
        status: newStatus,
        journalEntryId,
      };
    });
  }

  async getCustomerLedger(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        receivables: {
          include: { document: true },
          orderBy: { dueDate: 'asc' },
        },
        cashierReceipts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const totalInvoiced = customer.receivables.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalOutstanding = customer.receivables.reduce((sum, r) => sum + Number(r.outstanding), 0);
    const totalPaid = totalInvoiced - totalOutstanding;
    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        branchId: customer.branchId,
      },
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      receivables: customer.receivables,
      receipts: customer.cashierReceipts,
    };
  }

  async getSupplierLedger(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        payables: {
          include: { document: true },
          orderBy: { dueDate: 'asc' },
        },
        orders: {
          orderBy: { orderedAt: 'desc' },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const totalBilled = supplier.payables.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalOutstanding = supplier.payables.reduce((sum, p) => sum + Number(p.outstanding), 0);
    const totalPaid = totalBilled - totalOutstanding;
    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
      },
      totalBilled,
      totalPaid,
      totalOutstanding,
      payables: supplier.payables,
      orders: supplier.orders,
    };
  }

  async incomeStatement(periodId?: string) {
    const period = periodId
      ? await this.prisma.fiscalPeriod.findUnique({ where: { id: periodId } })
      : await this.prisma.fiscalPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startsOn: 'desc' } });

    const whereLines: Prisma.JournalLineWhereInput = {
      journalEntry: {
        status: 'POSTED',
        ...(period ? { fiscalPeriodId: period.id } : {}),
      },
    };

    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        isActive: true,
        type: { in: ['REVENUE', 'EXPENSE'] },
      },
      include: {
        journalLines: {
          where: whereLines,
        },
      },
      orderBy: { code: 'asc' },
    });

    const revenues: Array<{ id: string; code: string; name: string; amount: number }> = [];
    const directCosts: Array<{ id: string; code: string; name: string; amount: number }> = [];
    const operatingExpenses: Array<{ id: string; code: string; name: string; amount: number }> = [];

    let totalRevenue = 0;
    let totalDirectCosts = 0;
    let totalOperatingExpenses = 0;

    for (const acc of accounts) {
      const debit = acc.journalLines.reduce((sum, l) => sum.plus(l.debit), new Prisma.Decimal(0));
      const credit = acc.journalLines.reduce((sum, l) => sum.plus(l.credit), new Prisma.Decimal(0));

      if (acc.type === 'REVENUE') {
        const netRev = credit.minus(debit);
        const amount = Number(netRev);
        revenues.push({ id: acc.id, code: acc.code, name: acc.name, amount });
        totalRevenue += amount;
      } else if (acc.type === 'EXPENSE') {
        const netExp = debit.minus(credit);
        const amount = Number(netExp);
        if (acc.code.startsWith('50') || acc.code.startsWith('51')) {
          directCosts.push({ id: acc.id, code: acc.code, name: acc.name, amount });
          totalDirectCosts += amount;
        } else {
          operatingExpenses.push({ id: acc.id, code: acc.code, name: acc.name, amount });
          totalOperatingExpenses += amount;
        }
      }
    }

    const grossProfit = totalRevenue - totalDirectCosts;
    const netIncome = grossProfit - totalOperatingExpenses;

    return {
      period: period ? { id: period.id, name: period.name, startsOn: period.startsOn, endsOn: period.endsOn, status: period.status } : null,
      revenues,
      totalRevenue,
      directCosts,
      totalDirectCosts,
      grossProfit,
      operatingExpenses,
      totalOperatingExpenses,
      netIncome,
    };
  }

  async balanceSheet(asOfDate?: string) {
    const cutoffDate = asOfDate ? new Date(asOfDate) : new Date();
    const whereLines: Prisma.JournalLineWhereInput = {
      journalEntry: {
        status: 'POSTED',
        entryDate: { lte: cutoffDate },
      },
    };

    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { isActive: true },
      include: {
        journalLines: {
          where: whereLines,
        },
      },
      orderBy: { code: 'asc' },
    });

    const assets: Array<{ id: string; code: string; name: string; amount: number }> = [];
    const liabilities: Array<{ id: string; code: string; name: string; amount: number }> = [];
    const equity: Array<{ id: string; code: string; name: string; amount: number }> = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const acc of accounts) {
      const debit = acc.journalLines.reduce((sum, l) => sum.plus(l.debit), new Prisma.Decimal(0));
      const credit = acc.journalLines.reduce((sum, l) => sum.plus(l.credit), new Prisma.Decimal(0));

      if (acc.type === 'ASSET') {
        const bal = Number(debit.minus(credit));
        assets.push({ id: acc.id, code: acc.code, name: acc.name, amount: bal });
        totalAssets += bal;
      } else if (acc.type === 'LIABILITY') {
        const bal = Number(credit.minus(debit));
        liabilities.push({ id: acc.id, code: acc.code, name: acc.name, amount: bal });
        totalLiabilities += bal;
      } else if (acc.type === 'EQUITY') {
        const bal = Number(credit.minus(debit));
        equity.push({ id: acc.id, code: acc.code, name: acc.name, amount: bal });
        totalEquity += bal;
      } else if (acc.type === 'REVENUE') {
        totalRevenue += Number(credit.minus(debit));
      } else if (acc.type === 'EXPENSE') {
        totalExpenses += Number(debit.minus(credit));
      }
    }

    const currentYearNetIncome = totalRevenue - totalExpenses;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + currentYearNetIncome;
    const variance = Math.abs(totalAssets - totalLiabilitiesAndEquity);
    const isInEquilibrium = variance < 0.01;

    return {
      asOfDate: cutoffDate.toISOString(),
      assets,
      totalAssets,
      liabilities,
      totalLiabilities,
      equity,
      totalEquity,
      currentYearNetIncome,
      totalLiabilitiesAndEquity,
      isInEquilibrium,
      variance,
    };
  }
}
