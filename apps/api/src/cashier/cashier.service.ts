import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CashierTransactionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CashMovementDto,
  CloseSessionDto,
  OpenSessionDto,
  ReceiptDto,
  ReconcileDto,
  ReversalDto,
  VoucherDto,
  QueryReceiptsDto,
  QueryVouchersDto,
} from './dto/cashier.dto';

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees and Zero Paisa';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertGroup(n: number): string {
    let groupStr = '';
    if (n >= 100) {
      groupStr += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      groupStr += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      groupStr += units[n] + ' ';
    }
    return groupStr.trim();
  }

  const rupees = Math.floor(Math.abs(num));
  const paisa = Math.round((Math.abs(num) - rupees) * 100);

  let result = '';
  if (rupees === 0) {
    result = 'Zero Rupees';
  } else {
    const millions = Math.floor(rupees / 1000000);
    const thousands = Math.floor((rupees % 1000000) / 1000);
    const remainder = rupees % 1000;

    if (millions > 0) result += convertGroup(millions) + ' Million ';
    if (thousands > 0) result += convertGroup(thousands) + ' Thousand ';
    if (remainder > 0) result += convertGroup(remainder) + ' ';
    result = result.trim() + ' Rupees';
  }

  result += ` and ${paisa} Paisa`;
  return (num < 0 ? 'Negative ' : '') + result;
}

@Injectable()
export class CashierService {
  constructor(private readonly prisma: PrismaService) {}

  private decimal(value: number | string) {
    const d = new Prisma.Decimal(value);
    if (d.lte(0)) throw new BadRequestException('Amount must be positive');
    return d;
  }

  private async session(tx: Prisma.TransactionClient, id: string, cashierId?: string) {
    const s = await tx.cashierSession.findUnique({
      where: { id },
      include: {
        branch: true,
        transactions: { include: { originalTransaction: true } },
      },
    });
    if (!s || (cashierId && s.cashierId !== cashierId)) {
      throw new NotFoundException('Cashier session not found');
    }
    if (s.status !== 'OPEN') {
      throw new BadRequestException('Cashier session is closed');
    }
    return s;
  }

  async openSession(branchId: string, dto: OpenSessionDto, actorId: string) {
    const opening = new Prisma.Decimal(dto.openingBalance);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.cashierSession.findFirst({
        where: { cashierId: actorId, status: 'OPEN' },
      });
      if (existing) throw new BadRequestException('Cashier already has an active session');

      let resolvedBranchId = branchId;
      if (tx.branch?.findFirst) {
        const branch = await tx.branch.findFirst({
          where: branchId ? { OR: [{ id: branchId }, { code: branchId }] } : undefined,
        }) || await tx.branch.findFirst();
        if (branch) resolvedBranchId = branch.id;
      }

      const result = await tx.cashierSession.create({
        data: {
          branchId: resolvedBranchId,
          cashierId: actorId,
          openingBalance: opening,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'OPEN',
          entityType: 'CashierSession',
          entityId: result.id,
          metadata: { openingBalance: opening.toString(), branchId: resolvedBranchId },
        },
      });
      return result;
    });
  }

  listSessions(branchId?: string, cashierId?: string, status?: string) {
    return this.prisma.cashierSession.findMany({
      where: {
        branchId: branchId || undefined,
        cashierId: cashierId || undefined,
        status: status ? (status as any) : undefined,
      },
      orderBy: { openedAt: 'desc' },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        cashier: { select: { id: true, username: true } },
        closing: true,
      },
    });
  }

  getSession(id: string) {
    return this.prisma.cashierSession.findUnique({
      where: { id },
      include: {
        branch: true,
        transactions: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { id: true, username: true } }, originalTransaction: true },
        },
        receipts: {
          include: { customer: true, createdBy: { select: { id: true, username: true } } },
        },
        vouchers: {
          include: { createdBy: { select: { id: true, username: true } } },
        },
        closing: true,
        cashier: { select: { id: true, username: true } },
      },
    });
  }

  async closeSession(id: string, dto: CloseSessionDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const s = await this.session(tx, id);
      const expected = this.balance(s);
      const actual = new Prisma.Decimal(dto.actualBalance);
      const variance = actual.minus(expected);

      const result = await tx.cashierSession.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          expectedBalance: expected,
          closingBalance: actual,
        },
      });

      const closing = await tx.dailyCashierClosing.upsert({
        where: { sessionId: id },
        update: {
          closingDate: new Date(),
          expectedAmount: expected,
          actualAmount: actual,
          variance,
          notes: dto.notes,
          createdById: actorId,
          status: 'COMPLETED',
        },
        create: {
          sessionId: id,
          branchId: s.branchId,
          closingDate: new Date(),
          expectedAmount: expected,
          actualAmount: actual,
          variance,
          notes: dto.notes,
          createdById: actorId,
          status: 'COMPLETED',
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CLOSE',
          entityType: 'CashierSession',
          entityId: id,
          metadata: {
            expected: expected.toString(),
            actual: actual.toString(),
            variance: variance.toString(),
          },
        },
      });
      return { session: result, closing };
    });
  }

  private balance(s: {
    openingBalance: Prisma.Decimal;
    transactions: Array<{
      type: CashierTransactionType;
      status: string;
      amount: Prisma.Decimal;
      paymentMethod: string;
      originalTransaction?: { type: CashierTransactionType } | null;
    }>;
  }) {
    return s.transactions.reduce((total, t) => {
      if (t.paymentMethod !== 'CASH') return total;
      if (t.status === 'REVERSED' || t.type === 'REVERSAL') return total;
      const outflow = t.type === 'CASH_OUT' || t.type === 'PAYMENT_VOUCHER';
      return total.plus(outflow ? t.amount.negated() : t.amount);
    }, new Prisma.Decimal(s.openingBalance));
  }

  private async postJournal(
    tx: Prisma.TransactionClient,
    amount: Prisma.Decimal,
    isIn: boolean,
    docType: string,
    sourceType: string,
    sourceId: string,
    actorId: string,
  ) {
    const cash = await tx.chartOfAccount.findFirst({ where: { code: '1000', isActive: true } });
    if (!cash) throw new BadRequestException('Cash and Bank account (1000) not found');

    let offsetCode = '1100'; // Default AR
    if (docType === 'PAYMENT_VOUCHER' || docType === 'CASH_OUT') {
      offsetCode = sourceType === 'PAYABLE' ? '2000' : '5200'; // AP or Operating Expenses
    } else if (docType === 'CASH_IN') {
      offsetCode = sourceType === 'EQUITY' ? '3000' : '1100';
    }

    let offsetAccount = await tx.chartOfAccount.findFirst({ where: { code: offsetCode, isActive: true } });
    if (!offsetAccount) {
      offsetAccount = await tx.chartOfAccount.findFirst({ where: { code: '1100', isActive: true } });
    }
    if (!offsetAccount) throw new BadRequestException('Offsetting ledger account not found');

    const period = await tx.fiscalPeriod.findFirst({
      where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } },
    });
    if (!period) throw new BadRequestException('No open fiscal period covers the entry date');

    const debitAccountId = isIn ? cash.id : offsetAccount.id;
    const creditAccountId = isIn ? offsetAccount.id : cash.id;

    const entry = await tx.journalEntry.create({
      data: {
        fiscalPeriodId: period.id,
        entryDate: new Date(),
        description: `Cashier ${docType} (${sourceType})`,
        sourceType: docType,
        sourceId,
        createdById: actorId,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: debitAccountId, debit: amount, credit: 0 },
            { accountId: creditAccountId, debit: 0, credit: amount },
          ],
        },
      },
      include: { lines: true },
    });
    return entry;
  }

  async movement(id: string, dto: CashMovementDto, type: 'CASH_IN' | 'CASH_OUT', actorId: string) {
    const amount = this.decimal(dto.amount);
    return this.prisma.$transaction(async (tx) => {
      const s = await this.session(tx, id, actorId);
      if (type === 'CASH_OUT' && this.balance(s).lt(amount) && dto.paymentMethod === 'CASH') {
        throw new BadRequestException('Insufficient session cash');
      }

      const t = await tx.cashierTransaction.create({
        data: {
          sessionId: id,
          actorId,
          type,
          amount,
          paymentMethod: dto.paymentMethod,
          reason: dto.reason,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
        },
      });

      const j = await this.postJournal(
        tx,
        amount,
        type === 'CASH_IN',
        type,
        dto.sourceType || 'CashMovement',
        t.id,
        actorId,
      );

      const result = await tx.cashierTransaction.update({
        where: { id: t.id },
        data: { journalEntryId: j.id },
      });

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'POST',
          entityType: 'CashierTransaction',
          entityId: t.id,
          metadata: { type, amount: amount.toString(), journalEntryId: j.id },
        },
      });
      return result;
    });
  }

  async receipt(id: string, dto: ReceiptDto, actorId: string) {
    const amount = this.decimal(dto.amount);
    return this.document(id, dto, actorId, 'RECEIPT', async (tx, t) => {
      const count = await tx.cashierReceipt.count();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const receiptNo = `RCPT-${dateStr}-${String(count + 1).padStart(4, '0')}`;

      let resolvedCustomerId: string | null = null;
      if (dto.customerId) {
        const cust = await tx.customer.findFirst({
          where: {
            OR: [
              { id: dto.customerId },
              { name: dto.customerId },
              { phone: dto.customerId },
            ],
          },
        });
        if (cust) resolvedCustomerId = cust.id;
      }

      // Operational Receivable settlement integration
      if (dto.sourceType === 'RECEIVABLE' && dto.sourceId) {
        const rec = await tx.receivable.findUnique({ where: { id: dto.sourceId } });
        if (rec) {
          const newOutstanding = Prisma.Decimal.max(0, rec.outstanding.minus(amount));
          await tx.receivable.update({
            where: { id: rec.id },
            data: {
              outstanding: newOutstanding,
              status: newOutstanding.lte(0) ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
          if (!resolvedCustomerId) resolvedCustomerId = rec.customerId;
        }
      }

      return tx.cashierReceipt.create({
        data: {
          receiptNo,
          sessionId: id,
          transactionId: t.id,
          createdById: actorId,
          customerId: resolvedCustomerId,
          amount,
          paymentMethod: dto.paymentMethod,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
        },
        include: { customer: true, createdBy: { select: { id: true, username: true } } },
      });
    });
  }

  async voucher(id: string, dto: VoucherDto, actorId: string) {
    const amount = this.decimal(dto.amount);
    return this.document(id, dto, actorId, 'PAYMENT_VOUCHER', async (tx, t) => {
      const count = await tx.paymentVoucher.count();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const voucherNo = `PV-${dateStr}-${String(count + 1).padStart(4, '0')}`;

      // Operational Payable settlement integration
      if (dto.sourceType === 'PAYABLE' && dto.sourceId) {
        const pay = await tx.payable.findUnique({ where: { id: dto.sourceId } });
        if (pay) {
          const newOutstanding = Prisma.Decimal.max(0, pay.outstanding.minus(amount));
          await tx.payable.update({
            where: { id: pay.id },
            data: {
              outstanding: newOutstanding,
              status: newOutstanding.lte(0) ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
        }
      }

      return tx.paymentVoucher.create({
        data: {
          voucherNo,
          sessionId: id,
          transactionId: t.id,
          createdById: actorId,
          payee: dto.payee,
          amount,
          paymentMethod: dto.paymentMethod,
          reason: dto.reason,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
        },
        include: { createdBy: { select: { id: true, username: true } } },
      });
    });
  }

  private async document(
    id: string,
    dto: CashMovementDto,
    actorId: string,
    type: 'RECEIPT' | 'PAYMENT_VOUCHER',
    createDoc: (tx: Prisma.TransactionClient, t: { id: string }) => Promise<unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const s = await this.session(tx, id, actorId);
      if (type === 'PAYMENT_VOUCHER' && this.balance(s).lt(dto.amount) && dto.paymentMethod === 'CASH') {
        throw new BadRequestException('Insufficient session cash');
      }

      const t = await tx.cashierTransaction.create({
        data: {
          sessionId: id,
          actorId,
          type,
          amount: this.decimal(dto.amount),
          paymentMethod: dto.paymentMethod,
          reason: dto.reason,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
        },
      });

      const j = await this.postJournal(
        tx,
        this.decimal(dto.amount),
        type === 'RECEIPT',
        type,
        dto.sourceType || type,
        t.id,
        actorId,
      );

      await tx.cashierTransaction.update({
        where: { id: t.id },
        data: { journalEntryId: j.id },
      });

      const doc = await createDoc(tx, t);

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'POST',
          entityType: type,
          entityId: t.id,
          metadata: { amount: dto.amount, paymentMethod: dto.paymentMethod, journalEntryId: j.id },
        },
      });
      return doc;
    });
  }

  async reverse(
    id: string,
    dto: ReversalDto,
    actorId: string,
    actorRoles: string[] = [],
    actorPermissions: string[] = [],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.cashierTransaction.findUnique({
        where: { id },
        include: { session: true, receipt: true, voucher: true },
      });
      if (!original || original.status !== 'POSTED') {
        throw new BadRequestException('Only a posted cashier transaction can be reversed');
      }
      if (original.session.status !== 'OPEN') {
        throw new BadRequestException('Session is closed');
      }

      // Self-approval prohibition enforcement
      if (original.actorId === actorId) {
        const isSupervisor =
          actorRoles.some((r) =>
            ['Director / Managing Director', 'Accounts Manager', 'System Administrator'].includes(r),
          ) || actorPermissions.includes('approvals.decide') || actorPermissions.includes('cashier.reversal.approve');
        if (!isSupervisor) {
          throw new BadRequestException(
            'Cashiers are strictly prohibited from self-approving reversals. Supervisor approval is required.',
          );
        }
      }

      const approvedById = dto.approvedById || actorId;

      const reversal = await tx.cashierTransaction.create({
        data: {
          sessionId: original.sessionId,
          actorId,
          approvedById,
          originalTransactionId: id,
          type: 'REVERSAL',
          amount: original.amount,
          paymentMethod: original.paymentMethod,
          reason: dto.reason,
          sourceType: 'REVERSAL',
          sourceId: id,
        },
      });

      const isIn = original.type === 'CASH_OUT' || original.type === 'PAYMENT_VOUCHER';
      const j = await this.postJournal(
        tx,
        original.amount,
        isIn,
        'REVERSAL',
        original.sourceType || 'CashierReversal',
        reversal.id,
        actorId,
      );

      await tx.cashierTransaction.update({
        where: { id: reversal.id },
        data: { journalEntryId: j.id },
      });

      await tx.cashierTransaction.update({
        where: { id },
        data: { status: 'REVERSED' },
      });

      if (original.receipt) {
        await tx.cashierReceipt.update({
          where: { id: original.receipt.id },
          data: { status: 'REVERSED' },
        });

        // Roll back operational receivable settlement if applicable
        if (original.receipt.sourceType === 'RECEIVABLE' && original.receipt.sourceId) {
          const rec = await tx.receivable.findUnique({ where: { id: original.receipt.sourceId } });
          if (rec) {
            const restoredOutstanding = Prisma.Decimal.min(rec.amount, rec.outstanding.plus(original.amount));
            await tx.receivable.update({
              where: { id: rec.id },
              data: {
                outstanding: restoredOutstanding,
                status: restoredOutstanding.gte(rec.amount) ? 'OPEN' : 'PARTIALLY_PAID',
              },
            });
          }
        }
      }

      if (original.voucher) {
        await tx.paymentVoucher.update({
          where: { id: original.voucher.id },
          data: { status: 'REVERSED' },
        });

        // Roll back operational payable settlement if applicable
        if (original.voucher.sourceType === 'PAYABLE' && original.voucher.sourceId) {
          const pay = await tx.payable.findUnique({ where: { id: original.voucher.sourceId } });
          if (pay) {
            const restoredOutstanding = Prisma.Decimal.min(pay.amount, pay.outstanding.plus(original.amount));
            await tx.payable.update({
              where: { id: pay.id },
              data: {
                outstanding: restoredOutstanding,
                status: restoredOutstanding.gte(pay.amount) ? 'OPEN' : 'PARTIALLY_PAID',
              },
            });
          }
        }
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'REVERSE',
          entityType: 'CashierTransaction',
          entityId: id,
          metadata: { reversalId: reversal.id, reason: dto.reason, approvedById },
        },
      });
      return reversal;
    });
  }

  async reconcile(id: string, dto: ReconcileDto, actorId: string) {
    const session = await this.prisma.cashierSession.findUnique({
      where: { id },
      include: {
        transactions: { include: { originalTransaction: true } },
        closing: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    const expected = this.balance(session);
    const actual = new Prisma.Decimal(dto.actualAmount);
    const variance = actual.minus(expected);

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.dailyCashierClosing.upsert({
        where: { sessionId: id },
        update: {
          closingDate: new Date(dto.closingDate),
          expectedAmount: expected,
          actualAmount: actual,
          variance,
          notes: dto.notes,
          createdById: actorId,
          status: 'COMPLETED',
        },
        create: {
          sessionId: id,
          branchId: session.branchId,
          closingDate: new Date(dto.closingDate),
          expectedAmount: expected,
          actualAmount: actual,
          variance,
          notes: dto.notes,
          createdById: actorId,
          status: 'COMPLETED',
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'RECONCILE',
          entityType: 'DailyCashierClosing',
          entityId: result.id,
          metadata: {
            expected: expected.toString(),
            actual: actual.toString(),
            variance: variance.toString(),
          },
        },
      });
      return result;
    });
  }

  // --- Numbered receipts and printable output ---

  async listReceipts(query: QueryReceiptsDto) {
    return this.prisma.cashierReceipt.findMany({
      where: {
        sessionId: query.sessionId || undefined,
        customerId: query.customerId || undefined,
        sourceType: query.sourceType || undefined,
        receiptNo: query.receiptNo ? { contains: query.receiptNo } : undefined,
        createdAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      include: {
        customer: true,
        session: { include: { cashier: { select: { id: true, username: true } }, branch: true } },
        transaction: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReceipt(id: string) {
    const receipt = await this.prisma.cashierReceipt.findFirst({
      where: { OR: [{ id }, { receiptNo: id }] },
      include: {
        customer: true,
        session: { include: { cashier: { select: { id: true, username: true } }, branch: true } },
        transaction: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
    if (!receipt) throw new NotFoundException('Cashier receipt not found');
    return receipt;
  }

  async getPrintableReceipt(id: string) {
    const receipt = await this.getReceipt(id);
    const amountNum = Number(receipt.amount);
    const amountWords = numberToWords(amountNum);
    const dateFormatted = receipt.createdAt.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = receipt.createdAt.toLocaleTimeString('en-PK');

    const html = `
      <div class="printable-receipt" style="font-family: monospace; max-width: 400px; padding: 20px; border: 1px dashed #ccc; margin: auto;">
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">
          <h2 style="margin: 0; text-transform: uppercase;">GATEWAY MOTORS</h2>
          <p style="margin: 2px 0;">Official Dealership & Service Center</p>
          <p style="margin: 2px 0;">Branch: ${receipt.session.branch.name} (${receipt.session.branch.code})</p>
        </div>
        <div style="margin: 15px 0;">
          <table style="width: 100%; font-size: 13px;">
            <tr><td><b>Receipt No:</b></td><td style="text-align: right;">${receipt.receiptNo}</td></tr>
            <tr><td><b>Date / Time:</b></td><td style="text-align: right;">${dateFormatted} ${timeFormatted}</td></tr>
            <tr><td><b>Cashier:</b></td><td style="text-align: right;">${receipt.createdBy.username}</td></tr>
            <tr><td><b>Session ID:</b></td><td style="text-align: right;">${receipt.sessionId.slice(0, 10)}...</td></tr>
            <tr><td><b>Customer:</b></td><td style="text-align: right;">${receipt.customer ? receipt.customer.name : 'Counter Walk-in'}</td></tr>
            ${receipt.customer?.phone ? `<tr><td><b>Phone:</b></td><td style="text-align: right;">${receipt.customer.phone}</td></tr>` : ''}
            <tr><td><b>Method:</b></td><td style="text-align: right;">${receipt.paymentMethod}</td></tr>
            <tr><td><b>Reference:</b></td><td style="text-align: right;">${receipt.sourceType || 'General'} ${receipt.sourceId || ''}</td></tr>
            <tr><td><b>Status:</b></td><td style="text-align: right; font-weight: bold;">${receipt.status}</td></tr>
          </table>
        </div>
        <div style="border-top: 1px dashed #333; border-bottom: 1px dashed #333; padding: 10px 0; margin: 15px 0; text-align: right;">
          <div style="font-size: 18px; font-weight: bold;">TOTAL RECEIVED: Rs. ${amountNum.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</div>
          <div style="font-size: 11px; font-style: italic; margin-top: 4px;">(${amountWords})</div>
        </div>
        <div style="text-align: center; font-size: 11px; color: #666; margin-top: 20px;">
          <p>Thank you for your business!</p>
          <p>System generated document. Computerized signature valid.</p>
        </div>
      </div>
    `;

    return {
      receiptNo: receipt.receiptNo,
      receiptDate: receipt.createdAt,
      dealership: {
        name: 'Gateway Motors DMS',
        branchName: receipt.session.branch.name,
        branchCode: receipt.session.branch.code,
      },
      cashier: {
        id: receipt.createdBy.id,
        username: receipt.createdBy.username,
      },
      customer: receipt.customer
        ? {
            id: receipt.customer.id,
            name: receipt.customer.name,
            phone: receipt.customer.phone,
            email: receipt.customer.email,
          }
        : null,
      payment: {
        amount: amountNum,
        amountInWords: amountWords,
        paymentMethod: receipt.paymentMethod,
        sourceType: receipt.sourceType,
        sourceId: receipt.sourceId,
        transactionId: receipt.transactionId,
        status: receipt.status,
      },
      documentDetails: {
        title: 'OFFICIAL CASH RECEIPT',
        purpose: receipt.sourceType ? `Payment for ${receipt.sourceType}` : 'General customer payment',
        terms: 'Received with thanks. Goods once sold are not returnable without authorization.',
      },
      html,
    };
  }

  // --- Payment vouchers and printable output ---

  async listVouchers(query: QueryVouchersDto) {
    return this.prisma.paymentVoucher.findMany({
      where: {
        sessionId: query.sessionId || undefined,
        payee: query.payee ? { contains: query.payee } : undefined,
        voucherNo: query.voucherNo ? { contains: query.voucherNo } : undefined,
        createdAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      include: {
        session: { include: { cashier: { select: { id: true, username: true } }, branch: true } },
        transaction: true,
        createdBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getVoucher(id: string) {
    const voucher = await this.prisma.paymentVoucher.findFirst({
      where: { OR: [{ id }, { voucherNo: id }] },
      include: {
        session: { include: { cashier: { select: { id: true, username: true } }, branch: true } },
        transaction: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
    if (!voucher) throw new NotFoundException('Payment voucher not found');
    return voucher;
  }

  async getPrintableVoucher(id: string) {
    const voucher = await this.getVoucher(id);
    const amountNum = Number(voucher.amount);
    const amountWords = numberToWords(amountNum);
    const dateFormatted = voucher.createdAt.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = voucher.createdAt.toLocaleTimeString('en-PK');

    const html = `
      <div class="printable-voucher" style="font-family: monospace; max-width: 500px; padding: 20px; border: 1px solid #333; margin: auto;">
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">
          <h2 style="margin: 0; text-transform: uppercase;">GATEWAY MOTORS</h2>
          <p style="margin: 2px 0;">Official Payment Voucher</p>
          <p style="margin: 2px 0;">Branch: ${voucher.session.branch.name} (${voucher.session.branch.code})</p>
        </div>
        <div style="margin: 15px 0;">
          <table style="width: 100%; font-size: 13px;">
            <tr><td><b>Voucher No:</b></td><td style="text-align: right;">${voucher.voucherNo}</td></tr>
            <tr><td><b>Date / Time:</b></td><td style="text-align: right;">${dateFormatted} ${timeFormatted}</td></tr>
            <tr><td><b>Cashier:</b></td><td style="text-align: right;">${voucher.createdBy.username}</td></tr>
            <tr><td><b>Paid To:</b></td><td style="text-align: right; font-weight: bold;">${voucher.payee}</td></tr>
            <tr><td><b>Reason:</b></td><td style="text-align: right;">${voucher.reason}</td></tr>
            <tr><td><b>Method:</b></td><td style="text-align: right;">${voucher.paymentMethod}</td></tr>
            <tr><td><b>Reference:</b></td><td style="text-align: right;">${voucher.sourceType || 'Voucher'} ${voucher.sourceId || ''}</td></tr>
            <tr><td><b>Status:</b></td><td style="text-align: right; font-weight: bold;">${voucher.status}</td></tr>
          </table>
        </div>
        <div style="border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 10px 0; margin: 15px 0; text-align: right;">
          <div style="font-size: 18px; font-weight: bold;">TOTAL PAID: Rs. ${amountNum.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</div>
          <div style="font-size: 11px; font-style: italic; margin-top: 4px;">(${amountWords})</div>
        </div>
        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
          <div style="text-align: center; width: 45%; border-top: 1px solid #333; padding-top: 5px;">Cashier Signature</div>
          <div style="text-align: center; width: 45%; border-top: 1px solid #333; padding-top: 5px;">Recipient Signature</div>
        </div>
      </div>
    `;

    return {
      voucherNo: voucher.voucherNo,
      voucherDate: voucher.createdAt,
      dealership: {
        name: 'Gateway Motors DMS',
        branchName: voucher.session.branch.name,
        branchCode: voucher.session.branch.code,
      },
      cashier: {
        id: voucher.createdBy.id,
        username: voucher.createdBy.username,
      },
      payee: voucher.payee,
      amount: amountNum,
      amountInWords: amountWords,
      paymentMethod: voucher.paymentMethod,
      reason: voucher.reason,
      sourceType: voucher.sourceType,
      sourceId: voucher.sourceId,
      transactionId: voucher.transactionId,
      status: voucher.status,
      html,
    };
  }

  // --- Cashier-wise history and discrepancy reports ---

  async getDiscrepancyReport(branchId?: string, from?: string, to?: string) {
    const closings = await this.prisma.dailyCashierClosing.findMany({
      where: {
        branchId: branchId || undefined,
        closingDate: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        session: { include: { cashier: { select: { id: true, username: true } }, branch: true } },
        createdBy: { select: { id: true, username: true } },
      },
      orderBy: { closingDate: 'desc' },
    });

    let totalShortage = new Prisma.Decimal(0);
    let totalSurplus = new Prisma.Decimal(0);
    let netVariance = new Prisma.Decimal(0);
    let discrepantCount = 0;
    let balancedCount = 0;

    const records = closings.map((c) => {
      const v = new Prisma.Decimal(c.variance);
      netVariance = netVariance.plus(v);
      let type: 'BALANCED' | 'SHORTAGE' | 'SURPLUS' = 'BALANCED';

      if (v.lt(0)) {
        type = 'SHORTAGE';
        totalShortage = totalShortage.plus(v.abs());
        discrepantCount++;
      } else if (v.gt(0)) {
        type = 'SURPLUS';
        totalSurplus = totalSurplus.plus(v);
        discrepantCount++;
      } else {
        balancedCount++;
      }

      return {
        id: c.id,
        sessionId: c.sessionId,
        closingDate: c.closingDate,
        cashier: {
          id: c.session.cashier.id,
          username: c.session.cashier.username,
        },
        branch: {
          id: c.session.branch.id,
          code: c.session.branch.code,
          name: c.session.branch.name,
        },
        expectedAmount: Number(c.expectedAmount),
        actualAmount: Number(c.actualAmount),
        variance: Number(c.variance),
        type,
        notes: c.notes,
        status: c.status,
      };
    });

    return {
      summary: {
        totalClosings: closings.length,
        discrepantClosings: discrepantCount,
        balancedClosings: balancedCount,
        totalShortage: Number(totalShortage),
        totalSurplus: Number(totalSurplus),
        netVariance: Number(netVariance),
      },
      records,
    };
  }

  async getCashierSummary(branchId?: string, from?: string, to?: string) {
    const sessions = await this.prisma.cashierSession.findMany({
      where: {
        branchId: branchId || undefined,
        openedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        cashier: { select: { id: true, username: true } },
        transactions: true,
        closing: true,
      },
    });

    const cashierMap = new Map<string, {
      cashier: { id: string; username: string };
      totalSessions: number;
      activeSessions: number;
      closedSessions: number;
      totalReceiptsAmount: number;
      totalReceiptsCount: number;
      totalVouchersAmount: number;
      totalVouchersCount: number;
      totalCashInAmount: number;
      totalCashOutAmount: number;
      netCashFlow: number;
      totalDiscrepancy: number;
    }>();

    let grandReceipts = 0;
    let grandVouchers = 0;
    let grandCashIn = 0;
    let grandCashOut = 0;

    for (const s of sessions) {
      const cid = s.cashierId;
      if (!cashierMap.has(cid)) {
        cashierMap.set(cid, {
          cashier: s.cashier,
          totalSessions: 0,
          activeSessions: 0,
          closedSessions: 0,
          totalReceiptsAmount: 0,
          totalReceiptsCount: 0,
          totalVouchersAmount: 0,
          totalVouchersCount: 0,
          totalCashInAmount: 0,
          totalCashOutAmount: 0,
          netCashFlow: 0,
          totalDiscrepancy: 0,
        });
      }
      const item = cashierMap.get(cid)!;
      item.totalSessions++;
      if (s.status === 'OPEN') item.activeSessions++;
      if (s.status === 'CLOSED') item.closedSessions++;

      if (s.closing) {
        item.totalDiscrepancy += Number(s.closing.variance);
      }

      for (const t of s.transactions) {
        if (t.status !== 'POSTED') continue;
        const amt = Number(t.amount);
        if (t.type === 'RECEIPT') {
          item.totalReceiptsAmount += amt;
          item.totalReceiptsCount++;
          item.netCashFlow += amt;
          grandReceipts += amt;
        } else if (t.type === 'PAYMENT_VOUCHER') {
          item.totalVouchersAmount += amt;
          item.totalVouchersCount++;
          item.netCashFlow -= amt;
          grandVouchers += amt;
        } else if (t.type === 'CASH_IN') {
          item.totalCashInAmount += amt;
          item.netCashFlow += amt;
          grandCashIn += amt;
        } else if (t.type === 'CASH_OUT') {
          item.totalCashOutAmount += amt;
          item.netCashFlow -= amt;
          grandCashOut += amt;
        }
      }
    }

    return {
      dealershipTotals: {
        totalSessions: sessions.length,
        totalReceipts: grandReceipts,
        totalVouchers: grandVouchers,
        totalCashIn: grandCashIn,
        totalCashOut: grandCashOut,
        netCashMovement: grandReceipts + grandCashIn - grandVouchers - grandCashOut,
      },
      byCashier: Array.from(cashierMap.values()),
    };
  }
}
