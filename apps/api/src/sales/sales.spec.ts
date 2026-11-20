import { NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  function setup() {
    const tx = {
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }),
      },
      customer: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where?.sourceId) return Promise.resolve(null);
          return Promise.resolve({ id: where?.id || 'cust-1', branchId: 'branch-1' });
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({
          id: where.id || 'cust-1',
          name: 'Ahmed Khan',
          sourceId: 'CUST-0001',
          branchId: 'branch-1',
        })),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'cust-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({ id: 'veh-1', registrationNo: 'ABC-123' }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'veh-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      lead: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lead-1' }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'lead-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'bk-1', ...data })),
        findUnique: jest.fn().mockResolvedValue({ id: 'bk-1', status: 'RESERVED', notes: 'Initial note' }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'bk-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const prisma = {
      ...tx,
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };

    return { service: new SalesService(prisma as any), tx };
  }

  it('creates a customer and auto-generates a unique customer ID (CUST-0001)', async () => {
    const { service, tx } = setup();
    const result = await service.createCustomer(
      'branch-1',
      { name: 'Ahmed Khan', phone: '+92-300-1234567', email: 'ahmed@example.com' },
      'user-1',
    );
    expect(result).toBeDefined();
    expect(result?.name).toBe('Ahmed Khan');
    expect(tx.customer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Ahmed Khan',
        sourceId: 'CUST-0001',
      }),
    }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'CREATE',
        entityType: 'Customer',
      }),
    }));
  });

  it('creates a vehicle in inventory and logs audit event', async () => {
    const { service, tx } = setup();
    const result = await service.createVehicle(
      'branch-1',
      { registrationNo: 'ABC-123', make: 'Toyota', model: 'Corolla', modelYear: 2024, price: 5000000 },
      'user-1',
    );
    expect(result.id).toBe('veh-1');
    expect(result.make).toBe('Toyota');
    expect(tx.vehicle.create).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'CREATE',
        entityType: 'Vehicle',
      }),
    }));
  });

  it('creates a booking linked to customer and vehicle', async () => {
    const { service, tx } = setup();
    const result = await service.createBooking(
      'branch-1',
      {
        bookingNo: 'BK-1001',
        bookingDate: '2026-10-20T10:00:00Z',
        customerId: 'cust-1',
        vehicleId: 'veh-1',
        status: 'CONFIRMED',
      },
      'user-1',
    );
    expect(result.id).toBe('bk-1');
    expect(result.bookingNo).toBe('BK-1001');
    expect(tx.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bookingNo: 'BK-1001',
        customerId: 'cust-1',
        vehicleId: 'veh-1',
      }),
    }));
  });

  it('updates booking status and appends status note', async () => {
    const { service, tx } = setup();
    const updated = await service.updateBookingStatus('bk-1', 'COMPLETED', 'Delivered to customer', 'user-1');
    expect(updated.status).toBe('COMPLETED');
    expect(tx.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bk-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        notes: 'Initial note | Delivered to customer',
      }),
    }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'UPDATE',
        entityType: 'Booking',
      }),
    }));
  });

  it('throws NotFoundException when referenced customer is not found in branch', async () => {
    const { service, tx } = setup();
    tx.customer.findFirst.mockResolvedValue(null);
    await expect(service.createVehicle(
      'branch-1',
      { registrationNo: 'XYZ-999', make: 'Honda', model: 'Civic', customerId: 'non-existent-cust' },
      'user-1',
    )).rejects.toThrow(NotFoundException);
  });
});
