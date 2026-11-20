import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  function setup(quantity: string) {
    const tx = {
      location: {
        findUnique: jest.fn().mockResolvedValue({ id: 'loc-1', code: 'MAIN' }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const locId = where?.OR?.[0]?.id || where?.OR?.[1]?.code || 'loc-1';
          return Promise.resolve({ id: locId === 'loc-2' ? 'loc-2' : 'loc-1', code: locId === 'loc-2' ? 'WORKSHOP' : 'MAIN' });
        }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'balance-1', quantity: new Prisma.Decimal(quantity), averageCost: new Prisma.Decimal(100), inventoryValue: new Prisma.Decimal(quantity).times(100) }]),
      stockTransaction: { create: jest.fn().mockResolvedValue({ id: 'movement-1' }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)) };
    return { service: new InventoryService(prisma as any), tx };
  }

  it('issues stock and records the resulting balance', async () => {
    const { service, tx } = setup('10');
    const result = await service.issue({ locationId: 'loc-1', itemCode: 'FILTER', quantity: 3 } as any, 'user-1');
    expect(result.quantity.toString()).toBe('7');
    expect(result.totalCost.toString()).toBe('-300');
    expect(tx.stockTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'ISSUE', quantity: new Prisma.Decimal(3) }) }),
    );
  });

  it('rejects an over-issue before changing balance or creating a movement', async () => {
    const { service, tx } = setup('2');
    await expect(service.issue({ locationId: 'loc-1', itemCode: 'FILTER', quantity: 3 } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.stockTransaction.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // the lock-row insert only
  });

  it('transfers stock atomically between locations', async () => {
    const { service, tx } = setup('15');
    const result = await service.transfer(
      {
        fromLocationId: 'loc-1',
        toLocationId: 'loc-2',
        itemCode: 'FILTER',
        quantity: 5,
        reference: 'Stock rebalance to workshop',
      },
      'user-1',
    );
    expect(result.fromQuantity.toString()).toBe('10');
    expect(result.toQuantity.toString()).toBe('20');
    expect(tx.stockTransaction.create).toHaveBeenCalledTimes(2);
  });

  it('adjusts stock quantity to match physical count', async () => {
    const { service, tx } = setup('12');
    const result = await service.adjust(
      {
        locationId: 'loc-1',
        itemCode: 'FILTER',
        newQuantity: 10,
        reason: 'Physical count variance',
      },
      'user-1',
    );
    expect(result.quantity.toString()).toBe('10');
    expect(result.difference.toString()).toBe('-2');
    expect(tx.stockTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'ADJUSTMENT' }) }),
    );
  });
});
