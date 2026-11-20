import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PartsService } from './parts.service';

describe('PartsService', () => {
  function setup() {
    const tx = {
      part: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where?.code === 'EXISTING') {
            return Promise.resolve({ id: 'part-1', code: 'EXISTING', name: 'Existing Part', isActive: true, reorderLevel: new Prisma.Decimal(5) });
          }
          if (where?.code === 'OIL-FILTER') {
            return Promise.resolve({ id: 'part-2', code: 'OIL-FILTER', name: 'Oil Filter', isActive: true, reorderLevel: new Prisma.Decimal(10) });
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'part-new', ...data })),
        findMany: jest.fn().mockResolvedValue([
          { id: 'part-1', code: 'OIL-FILTER', name: 'Oil Filter', unit: 'EA', reorderLevel: new Prisma.Decimal(10) },
        ]),
      },
      supplier: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sup-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'sup-1', code: 'OEM-SUPPLIER', name: 'OEM Supplier Inc.' }),
      },
      location: {
        findFirst: jest.fn().mockResolvedValue({ id: 'loc-main', code: 'MAIN', name: 'Main Parts Store' }),
      },
      stockBalance: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'bal-1', locationId: 'loc-main', itemCode: 'OIL-FILTER', quantity: new Prisma.Decimal(4) },
        ]),
      },
      purchaseOrder: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'po-1', ...data })),
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          orderNo: 'PO-TEST01',
          status: 'SENT',
          supplierId: 'sup-1',
          supplier: { id: 'sup-1', name: 'OEM Supplier Inc.' },
          lines: [
            {
              id: 'pol-1',
              partId: 'part-2',
              quantity: new Prisma.Decimal(10),
              unitCost: new Prisma.Decimal(500),
              part: { id: 'part-2', code: 'OIL-FILTER', name: 'Oil Filter' },
            },
          ],
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'po-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      goodsReceipt: {
        create: jest.fn().mockResolvedValue({ id: 'gr-1', receiptNo: 'GR-TEST01' }),
      },
      financeDocument: {
        create: jest.fn().mockResolvedValue({ id: 'doc-1', documentNo: 'DOC-TEST01' }),
        update: jest.fn().mockResolvedValue({ id: 'doc-1', journalEntryId: 'je-1' }),
      },
      payable: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1', amount: new Prisma.Decimal(5000) }),
      },
      chartOfAccount: {
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: `acc-${where.code}`, code: where.code })),
      },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'fp-2026', status: 'OPEN' }),
      },
      journalEntry: {
        create: jest.fn().mockResolvedValue({ id: 'je-1', status: 'POSTED' }),
      },
      partsIssue: {
        create: jest.fn().mockResolvedValue({ id: 'pi-1' }),
      },
      partsReturn: {
        create: jest.fn().mockResolvedValue({ id: 'pr-1' }),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const inventory = {
      receive: jest.fn().mockResolvedValue({ quantity: new Prisma.Decimal(14) }),
      issue: jest.fn().mockResolvedValue({ quantity: new Prisma.Decimal(2) }),
      return: jest.fn().mockResolvedValue({ quantity: new Prisma.Decimal(6) }),
      transfer: jest.fn().mockResolvedValue({ fromQuantity: new Prisma.Decimal(4), toQuantity: new Prisma.Decimal(10) }),
      adjust: jest.fn().mockResolvedValue({ quantity: new Prisma.Decimal(10) }),
      listTransactions: jest.fn().mockResolvedValue([]),
    };

    const prisma = {
      ...tx,
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };

    return { service: new PartsService(prisma as any, inventory as any), tx, inventory };
  }

  it('creates a custom part with unit and reorder point', async () => {
    const { service, tx } = setup();
    const result = await service.createPart(
      { code: 'SPARK-PLUG', name: 'Iridium Spark Plug', unit: 'EA', reorderLevel: 20 },
      'user-1',
    );
    expect(result.code).toBe('SPARK-PLUG');
    expect(tx.part.create).toHaveBeenCalled();
  });

  it('rejects duplicate part codes', async () => {
    const { service } = setup();
    await expect(service.createPart(
      { code: 'EXISTING', name: 'Duplicate Part' },
      'user-1',
    )).rejects.toThrow(BadRequestException);
  });

  it('creates multiple parts in batch', async () => {
    const { service, tx } = setup();
    const result = await service.createPartsBatch([
      { code: 'BULB-H4', name: 'Halogen Headlight Bulb H4', unit: 'EA' },
      { code: 'WIPER-22', name: 'Windshield Wiper Blade 22"', unit: 'EA' },
    ], 'user-1');
    expect(result).toHaveLength(2);
    expect(tx.part.create).toHaveBeenCalledTimes(2);
  });

  it('evaluates stock summary with low stock warnings', async () => {
    const { service } = setup();
    const summary = await service.stockSummary('MAIN');
    expect(summary.length).toBeGreaterThan(0);
    const oilFilter = summary.find(s => s.itemCode === 'OIL-FILTER');
    expect(oilFilter).toBeDefined();
    expect(oilFilter?.isLowStock).toBe(true);
    expect(oilFilter?.status).toBe('LOW_STOCK');
  });

  it('receives a purchase order, updates inventory, creates payable, and posts journal entry', async () => {
    const { service, tx, inventory } = setup();
    const result = await service.receivePurchaseOrder('po-1', 'MAIN', 'user-1');
    expect(result.success).toBe(true);
    expect(inventory.receive).toHaveBeenCalledWith(
      expect.objectContaining({ itemCode: 'OIL-FILTER', quantity: 10 }),
      'user-1',
    );
    expect(tx.goodsReceipt.create).toHaveBeenCalled();
    expect(tx.payable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal(5000),
          status: 'OPEN',
        }),
      }),
    );
    expect(tx.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'POSTED',
          lines: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ accountId: 'acc-1200', debit: new Prisma.Decimal(5000) }),
              expect.objectContaining({ accountId: 'acc-2000', credit: new Prisma.Decimal(5000) }),
            ]),
          }),
        }),
      }),
    );
  });
});
