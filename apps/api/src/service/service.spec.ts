import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../auth/auth.constants';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

describe('ServiceController & ServiceService', () => {
  describe('RBAC permission boundaries on ServiceController', () => {
    const permission = (method: string) =>
      Reflect.getMetadata(PERMISSIONS_KEY, (ServiceController.prototype as any)[method]);

    it('enforces distinct permissions across the entire mechanical service lifecycle', () => {
      expect(permission('list')).toEqual(['service.jobcard.read']);
      expect(permission('getOne')).toEqual(['service.jobcard.read']);
      expect(permission('vehicleHistory')).toEqual(['service.jobcard.read']);
      expect(permission('customerHistory')).toEqual(['service.jobcard.read']);
      expect(permission('create')).toEqual(['service.jobcard.create']);
      expect(permission('packages')).toEqual(['service.jobcard.read']);
      expect(permission('createPackage')).toEqual(['service.jobcard.create']);
      expect(permission('estimate')).toEqual(['service.estimate.create']);
      expect(permission('approve')).toEqual(['service.estimate.approve']);
      expect(permission('assign')).toEqual(['service.assign']);
      expect(permission('parts')).toEqual(['service.parts.request']);
      expect(permission('labor')).toEqual(['service.labor.record']);
      expect(permission('status')).toEqual(['service.status.update']);
      expect(permission('statusPatch')).toEqual(['service.status.update']);
      expect(permission('inspection')).toEqual(['service.inspection.record']);
      expect(permission('checkEvents')).toEqual(['service.jobcard.read']);
      expect(permission('checkEvent')).toEqual(['service.status.update']);
      expect(permission('invoice')).toEqual(['service.invoice.read']);
      expect(permission('listInvoices')).toEqual(['service.invoice.read']);
      expect(permission('postInvoice')).toEqual(['finance.journal.create']);
      expect(permission('workload')).toEqual(['service.jobcard.read']);
      expect(permission('performance')).toEqual(['service.jobcard.read']);
    });
  });

  describe('ServiceService business logic', () => {
    let service: ServiceService;
    let prismaMock: any;
    let inventoryMock: any;
    let financeMock: any;

    beforeEach(() => {
      prismaMock = {
        customer: { findUnique: jest.fn() },
        vehicle: { findUnique: jest.fn(), update: jest.fn() },
        jobCard: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        servicePackage: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
        serviceCheckEvent: { create: jest.fn(), findMany: jest.fn() },
        part: { findMany: jest.fn(), count: jest.fn() },
        location: { findFirst: jest.fn() },
        user: { findFirst: jest.fn(), findUnique: jest.fn() },
        estimate: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
        technicianAssignment: { create: jest.fn(), updateMany: jest.fn() },
        partsRequest: { create: jest.fn() },
        laborOperation: { create: jest.fn() },
        inspection: { create: jest.fn() },
        serviceInvoice: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
        chartOfAccount: { findFirst: jest.fn() },
        fiscalPeriod: { findFirst: jest.fn() },
        journalEntry: { create: jest.fn() },
        auditEvent: { create: jest.fn() },
        $transaction: jest.fn(async (callback: any) => callback(prismaMock)),
      };
      inventoryMock = {};
        financeMock = {};

      service = new ServiceService(prismaMock, inventoryMock, financeMock);
    });

    it('creates a job card and associates customer to vehicle if unlinked', async () => {
      prismaMock.customer.findUnique.mockResolvedValue({ id: 'c-1', branchId: 'b-1', name: 'John Doe' });
      prismaMock.vehicle.findUnique.mockResolvedValue({ id: 'v-1', branchId: 'b-1', customerId: null });
      prismaMock.jobCard.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'jc-1', ...data }));

      const res = await service.createJobCard(
        { branchId: 'b-1', customerId: 'c-1', vehicleId: 'v-1', complaint: 'Engine oil leak', odometer: 24000 },
        'actor-1'
      );

      expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { customerId: 'c-1' },
      });
      expect(res.jobNo).toMatch(/^JC-/);
      expect(res.branchId).toBe('b-1');
      expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE',
            entityType: 'JobCard',
          }),
        })
      );
    });

    it('rejects inactive or missing service packages on job creation', async () => {
      prismaMock.customer.findUnique.mockResolvedValue({ id: 'c-1', branchId: 'b-1' });
      prismaMock.vehicle.findUnique.mockResolvedValue({ id: 'v-1', branchId: 'b-1', customerId: 'c-1' });
      prismaMock.servicePackage.findFirst.mockResolvedValue(null);

      await expect(service.createJobCard({ branchId: 'b-1', customerId: 'c-1', vehicleId: 'v-1', packageId: 'pkg-1' }, 'actor-1'))
        .rejects.toThrow('Service package not found or inactive');
    });

    it('rejects job card creation if vehicle belongs to another customer', async () => {
      prismaMock.customer.findUnique.mockResolvedValue({ id: 'c-1', branchId: 'b-1' });
      prismaMock.vehicle.findUnique.mockResolvedValue({ id: 'v-1', branchId: 'b-1', customerId: 'c-2' });

      await expect(
        service.createJobCard({ branchId: 'b-1', customerId: 'c-1', vehicleId: 'v-1' }, 'actor-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('creates and approves estimates cleanly', async () => {
      prismaMock.jobCard.findUnique.mockResolvedValue({ id: 'jc-1', branchId: 'b-1' });
      prismaMock.part.findMany.mockResolvedValue([{ id: 'p-1', code: 'OIL-FLT', isActive: true }]);
      prismaMock.estimate.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'est-1', ...data }));

      const est = await service.createEstimate(
        'jc-1',
        {
          notes: 'Standard service',
          lines: [{ description: 'Oil filter', quantity: 1, unitPrice: 45, lineType: 'PART', partId: 'OIL-FLT' }],
        },
        'advisor-1'
      );

      expect(est.estimateNo).toMatch(/^EST-/);
      expect(prismaMock.jobCard.update).toHaveBeenCalledWith({
        where: { id: 'jc-1' },
        data: { status: 'ESTIMATED' },
      });

      // Now approve estimate
      prismaMock.estimate.findUnique.mockResolvedValue({ id: 'est-1', jobCardId: 'jc-1', status: 'PENDING_APPROVAL' });
      prismaMock.estimate.update.mockResolvedValue({ id: 'est-1', status: 'APPROVED' });

      const approved = await service.approveEstimate('est-1', 'advisor-1');
      expect(approved.status).toBe('APPROVED');
      expect(prismaMock.jobCard.update).toHaveBeenCalledWith({
        where: { id: 'jc-1' },
        data: { status: 'APPROVED' },
      });
    });

    it('rejects estimate self-approval by the job-card requester', async () => {
      prismaMock.estimate.findUnique.mockResolvedValue({
        id: 'est-self',
        jobCardId: 'jc-self',
        status: 'PENDING_APPROVAL',
        jobCard: { createdById: 'advisor-1' },
      });

      await expect(service.approveEstimate('est-self', 'advisor-1')).rejects.toThrow('cannot approve their own estimate');
      expect(prismaMock.estimate.update).not.toHaveBeenCalled();
    });

    it('assigns technician and progresses job card to IN_PROGRESS', async () => {
      prismaMock.jobCard.findUnique.mockResolvedValue({ id: 'jc-1', status: 'APPROVED' });
      prismaMock.user.findFirst.mockResolvedValue({ id: 'tech-1', username: 'technician' });
      prismaMock.technicianAssignment.create.mockResolvedValue({ id: 'ta-1', jobCardId: 'jc-1', technicianId: 'tech-1' });

      const assignment = await service.assignTechnician('jc-1', { technicianId: 'technician' }, 'advisor-1');

      expect(prismaMock.technicianAssignment.updateMany).toHaveBeenCalledWith({
        where: { jobCardId: 'jc-1', releasedAt: null },
        data: expect.objectContaining({ releasedAt: expect.any(Date) }),
      });
      expect(prismaMock.jobCard.update).toHaveBeenCalledWith({
        where: { id: 'jc-1' },
        data: { status: 'IN_PROGRESS' },
      });
      expect(assignment.id).toBe('ta-1');
    });

    it('records inspection: advances to READY_FOR_INVOICE on pass, IN_PROGRESS on fail', async () => {
      prismaMock.jobCard.findUnique.mockResolvedValue({ id: 'jc-1' });
      prismaMock.inspection.create.mockResolvedValue({ id: 'insp-1', passed: true });

      await service.recordInspection('jc-1', { checklist: { brakes: true }, passed: true }, 'inspector-1');
      expect(prismaMock.jobCard.update).toHaveBeenCalledWith({
        where: { id: 'jc-1' },
        data: { status: 'READY_FOR_INVOICE' },
      });

      // Failed inspection
      prismaMock.inspection.create.mockResolvedValue({ id: 'insp-2', passed: false });
      await service.recordInspection('jc-1', { checklist: { brakes: false }, passed: false }, 'inspector-1');
      expect(prismaMock.jobCard.update).toHaveBeenCalledWith({
        where: { id: 'jc-1' },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('generates ServiceInvoice when transitioned to INVOICED', async () => {
      prismaMock.jobCard.findUnique.mockResolvedValue({
        id: 'jc-1',
        customer: { id: 'c-1', name: 'John Doe' },
        vehicle: { id: 'v-1' },
        labor: [{ hours: 2, rate: 100 }],
        estimates: [{ lines: [{ lineType: 'PART', quantity: 1, unitPrice: 50 }] }],
        partsRequests: [],
      });
      prismaMock.serviceInvoice.findFirst.mockResolvedValue(null);
      prismaMock.serviceInvoice.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'inv-1', ...data }));
      prismaMock.jobCard.update.mockResolvedValue({ id: 'jc-1', status: 'INVOICED' });

      const updated = await service.updateStatus('jc-1', 'INVOICED', 'advisor-1');

      expect(prismaMock.serviceInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobCardId: 'jc-1',
            subtotal: expect.anything(),
            total: expect.anything(),
            status: 'READY',
          }),
        })
      );
      expect(updated.status).toBe('INVOICED');
    });

    it('gates check-out until final inspection and closes an invoiced job on check-out', async () => {
      prismaMock.jobCard.findUnique.mockResolvedValue({ id: 'jc-1', status: 'IN_PROGRESS' });
      await expect(service.recordCheckEvent('jc-1', { type: 'CHECK_OUT' }, 'advisor-1')).rejects.toThrow('final inspection');

      prismaMock.jobCard.findUnique.mockResolvedValue({ id: 'jc-1', status: 'INVOICED' });
      prismaMock.serviceCheckEvent.create.mockResolvedValue({ id: 'evt-1', type: 'CHECK_OUT' });
      await service.recordCheckEvent('jc-1', { type: 'CHECK_OUT', odometer: 24010 }, 'advisor-1');
      expect(prismaMock.jobCard.update).toHaveBeenCalledWith({
        where: { id: 'jc-1' },
        data: { status: 'CLOSED', closedAt: expect.any(Date) },
      });
    });
  });
});
