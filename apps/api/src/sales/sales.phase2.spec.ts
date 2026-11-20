import { BadRequestException } from '@nestjs/common';
import { SalesService } from './sales.service';

describe('SalesService Phase 2 controls', () => {
  it('requires a customer on every booking', async () => {
    const tx = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
      numberSequence: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      booking: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    };
    const prisma = { ...tx, $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new SalesService(prisma as any);

    await expect(service.createBooking('branch-1', { bookingDate: '2026-10-25T10:00:00Z' }, 'salesperson-1')).rejects.toThrow('customer');
  });

  it('rejects a payment schedule larger than the booking total', async () => {
    const tx = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', totalAmount: 100000 }) },
      paymentSchedule: { deleteMany: jest.fn(), create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new SalesService(prisma as any);

    await expect(service.createPaymentSchedule('booking-1', {
      lines: [{ installmentNo: 1, dueDate: '2026-11-01', amount: 100001 }],
    }, 'salesperson-1')).rejects.toThrow('exceed booking total');
  });

  it('prevents a booking requester from approving their own request', async () => {
    const tx = {
      bookingRequest: {
        findUnique: jest.fn().mockResolvedValue({ id: 'request-1', status: 'PENDING', requesterId: 'salesperson-1', type: 'CANCELLATION', bookingId: 'booking-1', booking: { id: 'booking-1', status: 'CONFIRMED', vehicleId: null } }),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new SalesService(prisma as any);

    await expect(service.decideBookingRequest('request-1', { decision: 'APPROVED' }, 'salesperson-1')).rejects.toThrow(BadRequestException);
  });
});
