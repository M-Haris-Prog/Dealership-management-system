import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CashierService } from './cashier.service';

describe('CashierService controls', () => {
  it('allows one active session per cashier', async () => {
    const tx = { cashierSession: { findFirst: jest.fn().mockResolvedValue({ id: 'existing' }), create: jest.fn() }, auditEvent: { create: jest.fn() } };
    const service = new CashierService({ $transaction: jest.fn((cb: any) => cb(tx)) } as any);
    await expect(service.openSession('branch-1', { openingBalance: 100 } as any, 'cashier-1')).rejects.toThrow('active session');
    expect(tx.cashierSession.create).not.toHaveBeenCalled();
  });

  it('rejects cash over-issue and reversals from closed sessions', async () => {
    const tx: any = {
      cashierSession: { findUnique: jest.fn().mockResolvedValue({ id: 'session-1', cashierId: 'cashier-1', status: 'OPEN', openingBalance: new Prisma.Decimal(5), transactions: [] }) },
      cashierTransaction: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue({ id: 't-1', status: 'POSTED', session: { status: 'CLOSED' } }) },
    };
    const service = new CashierService({ $transaction: jest.fn((cb: any) => cb(tx)) } as any);
    await expect(service.movement('session-1', { amount: 6, paymentMethod: 'CASH' } as any, 'CASH_OUT', 'cashier-1')).rejects.toThrow('Insufficient session cash');
    expect(tx.cashierTransaction.create).not.toHaveBeenCalled();
    await expect(service.reverse('t-1', { reason: 'mistake' } as any, 'cashier-1')).rejects.toThrow('Session is closed');
  });

  it('prohibits cashier self-approval of reversals without supervisor role', async () => {
    const tx: any = {
      cashierTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't-1',
          actorId: 'cashier-1',
          status: 'POSTED',
          amount: new Prisma.Decimal(100),
          paymentMethod: 'CASH',
          session: { status: 'OPEN', id: 's-1' },
        }),
      },
    };
    const service = new CashierService({ $transaction: jest.fn((cb: any) => cb(tx)) } as any);
    await expect(
      service.reverse('t-1', { reason: 'wrong amount' }, 'cashier-1', ['Cashier'], ['cashier.reversal.create']),
    ).rejects.toThrow('Cashiers are strictly prohibited from self-approving reversals');
  });

  it('allows supervisor or manager to reverse transaction', async () => {
    const tx: any = {
      cashierTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't-1',
          actorId: 'cashier-1',
          status: 'POSTED',
          amount: new Prisma.Decimal(100),
          paymentMethod: 'CASH',
          type: 'RECEIPT',
          session: { status: 'OPEN', id: 's-1', sessionId: 's-1' },
        }),
        create: jest.fn().mockResolvedValue({ id: 'rev-1' }),
        update: jest.fn().mockResolvedValue({ id: 't-1', status: 'REVERSED' }),
      },
      chartOfAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'acc-1' }),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }),
      },
      journalEntry: {
        create: jest.fn().mockResolvedValue({ id: 'j-1' }),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const service = new CashierService({ $transaction: jest.fn((cb: any) => cb(tx)) } as any);
    const result = await service.reverse(
      't-1',
      { reason: 'supervisor approved' },
      'director-1',
      ['Director / Managing Director'],
      ['cashier.reversal.create'],
    );
    expect(result).toBeDefined();
    expect(tx.cashierTransaction.create).toHaveBeenCalled();
    expect(tx.cashierTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't-1' }, data: { status: 'REVERSED' } }),
    );
  });
});
