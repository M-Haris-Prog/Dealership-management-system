import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FinanceService } from './finance.service';

describe('FinanceService journal controls & Phase 6 expansions', () => {
  const period = { id: 'period-1', name: 'FY 2026', status: 'OPEN' };
  function serviceWith(tx: any) {
    return new FinanceService({
      $transaction: jest.fn((callback: (value: any) => unknown) => callback(tx)),
      fiscalPeriod: tx.fiscalPeriod,
      chartOfAccount: tx.chartOfAccount,
      receivable: tx.receivable,
      payable: tx.payable,
      customer: tx.customer,
      supplier: tx.supplier,
    } as any);
  }

  it('rejects unbalanced and malformed journal lines', async () => {
    const tx = { fiscalPeriod: { findFirst: jest.fn() } };
    const service = serviceWith(tx);
    await expect(service.createJournalDraft({ entryDate: '2026-01-01', lines: [{ accountId: 'a', debit: 10, credit: 0 }] } as any)).rejects.toThrow('must balance');
    await expect(service.createJournalDraft({ entryDate: '2026-01-01', lines: [{ accountId: 'a', debit: 10, credit: 1 }, { accountId: 'b', debit: 0, credit: 9 }] } as any)).rejects.toThrow('either a positive debit or credit');
  });

  it('creates a balanced draft only in an open period with active accounts', async () => {
    const tx = {
      fiscalPeriod: { findFirst: jest.fn().mockResolvedValue(period) },
      journalEntry: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'entry-1', status: 'DRAFT', lines: [] }) },
      chartOfAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'debit' }, { id: 'credit' }]) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const result = await serviceWith(tx).createJournalDraft({ entryDate: '2026-01-01', description: 'Sale', lines: [{ accountId: 'debit', debit: 10 }, { accountId: 'credit', credit: 10 }] } as any, 'actor-1');
    expect(result.id).toBe('entry-1');
    expect(tx.journalEntry.create).toHaveBeenCalled();
  });

  it('posts only drafts and reverses only posted entries in open periods', async () => {
    const tx: any = {
      journalEntry: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'entry-1', status: 'POSTED' }), create: jest.fn().mockResolvedValue({ id: 'reverse-1', lines: [] }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWith(tx);
    tx.journalEntry.findUnique.mockResolvedValue({ id: 'entry-1', status: 'POSTED', fiscalPeriod: period, lines: [] });
    await expect(service.postJournalEntry('entry-1')).rejects.toThrow('Only journal drafts');
    tx.journalEntry.findUnique.mockResolvedValue({ id: 'entry-1', status: 'DRAFT', fiscalPeriod: period, lines: [] });
    await expect(service.postJournalEntry('entry-1', 'actor')).resolves.toEqual(expect.objectContaining({ status: 'POSTED' }));
    tx.journalEntry.findUnique.mockResolvedValue({ id: 'entry-1', status: 'POSTED', fiscalPeriod: period, fiscalPeriodId: 'period-1', lines: [{ accountId: 'a', debit: new Prisma.Decimal(10), credit: new Prisma.Decimal(0) }] });
    await expect(service.reverseJournalEntry('entry-1', 'actor')).resolves.toEqual(expect.objectContaining({ id: 'reverse-1' }));
    tx.journalEntry.findUnique.mockResolvedValue({ id: 'entry-1', status: 'DRAFT', fiscalPeriod: period, lines: [] });
    await expect(service.reverseJournalEntry('entry-1', 'actor')).rejects.toThrow(BadRequestException);
  });

  it('closes fiscal period and blocks duplicate close', async () => {
    const tx: any = {
      fiscalPeriod: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p-1', name: 'FY 2026', status: 'OPEN' }),
        update: jest.fn().mockResolvedValue({ id: 'p-1', name: 'FY 2026', status: 'CLOSED' }),
      },
      fiscalPeriodCloseControl: {
        upsert: jest.fn().mockResolvedValue({ id: 'cc-1', checklist: [] }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWith(tx);
    const closed = await service.closePeriod('p-1', { checklist: ['Trial balance verified'] }, 'actor-1');
    expect(closed.status).toBe('CLOSED');
    expect(tx.fiscalPeriodCloseControl.upsert).toHaveBeenCalled();

    tx.fiscalPeriod.findUnique.mockResolvedValue({ id: 'p-1', status: 'CLOSED' });
    await expect(service.closePeriod('p-1', {}, 'actor-1')).rejects.toThrow('already closed');
  });

  it('settles receivable and automatically updates status and generates GL entry', async () => {
    const mockReceivable = {
      id: 'rec-1',
      outstanding: new Prisma.Decimal(500),
      status: 'OPEN',
      document: { documentNo: 'REC-001' },
      customer: { name: 'VIP Buyer' },
    };
    const tx: any = {
      receivable: {
        findUnique: jest.fn().mockResolvedValue(mockReceivable),
        update: jest.fn().mockResolvedValue({ ...mockReceivable, outstanding: new Prisma.Decimal(0), status: 'PAID' }),
      },
      chartOfAccount: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'acc-cash', code: '1000' })
          .mockResolvedValueOnce({ id: 'acc-ar', code: '1100' }),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue(period),
      },
      journalEntry: {
        create: jest.fn().mockResolvedValue({ id: 'j-settle' }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWith(tx);
    const result = await service.settleReceivable('rec-1', { amount: 500 }, 'actor-1');
    expect(result.success).toBe(true);
    expect(result.status).toBe('PAID');
    expect(result.outstanding).toBe(0);
    expect(tx.journalEntry.create).toHaveBeenCalled();
  });
});
