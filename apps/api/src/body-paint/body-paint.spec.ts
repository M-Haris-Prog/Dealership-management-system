import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../auth/auth.constants';
import { BodyPaintController } from './body-paint.controller';
import { BodyPaintService } from './body-paint.service';

describe('BodyPaintController & BodyPaintService', () => {
  describe('RBAC permission boundaries on BodyPaintController', () => {
    const permission = (method: string) =>
      Reflect.getMetadata(PERMISSIONS_KEY, (BodyPaintController.prototype as any)[method]);

    it('enforces distinct permissions across the entire Body & Paint workflow', () => {
      expect(permission('list')).toEqual(['bodypaint.repair-order.read']);
      expect(permission('getOne')).toEqual(['bodypaint.repair-order.read']);
      expect(permission('vehicleHistory')).toEqual(['bodypaint.repair-order.read']);
      expect(permission('customerHistory')).toEqual(['bodypaint.repair-order.read']);
      expect(permission('create')).toEqual(['bodypaint.repair-order.create']);
      expect(permission('insurance')).toEqual(['bodypaint.insurance.manage']);
      expect(permission('assessment')).toEqual(['bodypaint.assessment.create']);
      expect(permission('approval')).toEqual(['bodypaint.approval.manage']);
      expect(permission('approvalDecision')).toEqual(['bodypaint.approval.manage']);
      expect(permission('operation')).toEqual(['bodypaint.operation.manage']);
      expect(permission('updateOperation')).toEqual(['bodypaint.operation.manage']);
      expect(permission('movement')).toEqual(['bodypaint.movement.manage']);
      expect(permission('material')).toEqual(['bodypaint.material.manage']);
      expect(permission('status')).toEqual(['bodypaint.status.update']);
      expect(permission('statusPatch')).toEqual(['bodypaint.status.update']);
      expect(permission('invoice')).toEqual(['bodypaint.invoice.read']);
      expect(permission('finalInspection')).toEqual(['bodypaint.status.update']);
      expect(permission('invoices')).toEqual(['bodypaint.invoice.read']);
      expect(permission('createInvoice')).toEqual(['bodypaint.invoice.read']);
      expect(permission('postInvoice')).toEqual(['finance.journal.create']);
      expect(permission('deliver')).toEqual(['bodypaint.status.update']);
      expect(permission('workload')).toEqual(['bodypaint.repair-order.read']);
      expect(permission('performance')).toEqual(['bodypaint.repair-order.read']);
    });
  });

  describe('BodyPaintService business logic', () => {
    let service: BodyPaintService;
    let prismaMock: any;

    beforeEach(() => {
      prismaMock = {
        customer: { findUnique: jest.fn() },
        vehicle: { findUnique: jest.fn(), update: jest.fn() },
        bodyPaintRepairOrder: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        insuranceCase: { create: jest.fn(), findMany: jest.fn() },
        damageAssessment: { create: jest.fn(), findMany: jest.fn() },
        bodyPaintApproval: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
        bodyPaintOperation: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
        vehicleMovement: { create: jest.fn(), findMany: jest.fn() },
        materialConsumption: { create: jest.fn(), findMany: jest.fn() },
        invoiceReadySummary: { upsert: jest.fn() },
        bodyPaintInvoice: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
        bodyPaintFinalInspection: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
        chartOfAccount: { findFirst: jest.fn() },
        fiscalPeriod: { findFirst: jest.fn() },
        financeDocument: { create: jest.fn() },
        receivable: { create: jest.fn(), findMany: jest.fn() },
        journalEntry: { create: jest.fn() },
        part: { findFirst: jest.fn(), findUnique: jest.fn() },
        location: { findMany: jest.fn() },
        user: { findFirst: jest.fn(), findUnique: jest.fn() },
        auditEvent: { create: jest.fn() },
        $transaction: jest.fn(async (cb: any) => cb(prismaMock)),
      };

      service = new BodyPaintService(prismaMock);
    });

    it('creates a repair order and links unassociated vehicle to customer', async () => {
      prismaMock.customer.findUnique.mockResolvedValue({ id: 'c-1', branchId: 'b-1', name: 'Alice' });
      prismaMock.vehicle.findUnique.mockResolvedValue({ id: 'v-1', branchId: 'b-1', customerId: null });
      prismaMock.bodyPaintRepairOrder.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'bp-1', ...data }));

      const res = await service.create(
        { branchId: 'b-1', customerId: 'c-1', vehicleId: 'v-1', complaint: 'Accident front bumper damage' },
        'advisor-1'
      );

      expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { customerId: 'c-1' },
      });
      expect(res.orderNo).toMatch(/^BP-/);
      expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE',
            entityType: 'BodyPaintRepairOrder',
          }),
        })
      );
    });

    it('rejects repair order creation if vehicle is owned by another customer', async () => {
      prismaMock.customer.findUnique.mockResolvedValue({ id: 'c-1', branchId: 'b-1' });
      prismaMock.vehicle.findUnique.mockResolvedValue({ id: 'v-1', branchId: 'b-1', customerId: 'c-9' });

      await expect(
        service.create({ branchId: 'b-1', customerId: 'c-1', vehicleId: 'v-1' }, 'advisor-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('creates damage assessment and transitions repair order to ASSESSMENT', async () => {
      prismaMock.bodyPaintRepairOrder.findUnique.mockResolvedValue({ id: 'bp-1' });
      prismaMock.damageAssessment.create.mockResolvedValue({ id: 'da-1' });

      await service.assessment(
        'bp-1',
        { damageAreas: { bumper: 'crack', fender: 'dent' }, estimatedLabor: 300, estimatedMaterials: 150 },
        'assessor-1'
      );

      expect(prismaMock.bodyPaintRepairOrder.update).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
        data: { status: 'ASSESSMENT' },
      });
    });

    it('handles approval and updates repair order to APPROVED', async () => {
      prismaMock.bodyPaintRepairOrder.findUnique.mockResolvedValue({ id: 'bp-1' });
      prismaMock.bodyPaintApproval.create.mockResolvedValue({ id: 'appr-1' });

      await service.approval(
        'bp-1',
        { type: 'INSURER', status: 'APPROVED', approvedAmount: 450, approvedBy: 'State Insurance Assessor' },
        'advisor-1'
      );

      expect(prismaMock.bodyPaintRepairOrder.update).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
        data: { status: 'APPROVED' },
      });
    });

    it('rejects Body & Paint self-approval by the repair-order requester', async () => {
      prismaMock.bodyPaintApproval.findUnique.mockResolvedValue({
        id: 'approval-self',
        repairOrderId: 'bp-self',
        repairOrder: { createdById: 'advisor-1' },
      });

      await expect(service.decideApproval('approval-self', 'APPROVED', 'self', 'advisor-1')).rejects.toThrow('cannot decide their own');
      expect(prismaMock.bodyPaintApproval.update).not.toHaveBeenCalled();
    });

    it('records operation and advances repair order to IN_PROGRESS', async () => {
      prismaMock.bodyPaintRepairOrder.findUnique.mockResolvedValue({ id: 'bp-1', status: 'APPROVED' });
      prismaMock.user.findFirst.mockResolvedValue({ id: 'tech-1', username: 'technician' });
      prismaMock.bodyPaintOperation.create.mockResolvedValue({ id: 'op-1', status: 'IN_PROGRESS' });

      await service.operation(
        'bp-1',
        { type: 'BODY', description: 'Panel beating and dent pulling', hours: 3, rate: 90, status: 'IN_PROGRESS', technicianId: 'technician' },
        'advisor-1'
      );

      expect(prismaMock.bodyPaintRepairOrder.update).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('calculates invoiceReady summary with separated insurer and customer payable amounts', async () => {
      prismaMock.bodyPaintRepairOrder.findUnique.mockResolvedValue({
        id: 'bp-1',
        customer: { id: 'c-1', name: 'Alice' },
        vehicle: { id: 'v-1' },
        operations: [{ hours: 4, rate: 100 }], // 400
        materials: [{ quantity: 2, unitCost: 50 }], // 100 -> Total 500
        insuranceCases: [],
        approvals: [{ type: 'INSURER', status: 'APPROVED', approvedAmount: 350 }],
        assessments: [],
      });
      prismaMock.invoiceReadySummary.upsert.mockResolvedValue({
        laborTotal: 400,
        materialsTotal: 100,
        subtotal: 500,
        total: 500,
      });

      const summary = await service.invoiceReady('bp-1');
      expect(Number(summary.total)).toBe(500);
      expect(Number(summary.insurerPayable)).toBe(350);
      expect(Number(summary.customerPayable)).toBe(150);
    });

    it('records a passed final inspection and advances the repair order to invoice-ready', async () => {
      prismaMock.bodyPaintRepairOrder.findUnique.mockResolvedValue({ id: 'bp-1', status: 'QUALITY_CHECK' });
      prismaMock.bodyPaintFinalInspection.create.mockResolvedValue({ id: 'fi-1', passed: true });

      await service.finalInspection('bp-1', { checklist: { paint: true, gaps: true }, passed: true }, 'inspector-1');

      expect(prismaMock.bodyPaintRepairOrder.update).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
        data: { status: 'READY_FOR_INVOICE' },
      });
    });

    it('does not allow a direct collection transition without inspection and a posted invoice', async () => {
      prismaMock.bodyPaintRepairOrder.findUnique.mockResolvedValue({ id: 'bp-1', status: 'INVOICED' });
      prismaMock.bodyPaintFinalInspection.findFirst.mockResolvedValue(null);
      prismaMock.bodyPaintInvoice.findFirst.mockResolvedValue(null);

      await expect(service.status('bp-1', 'READY_FOR_COLLECTION', 'advisor-1')).rejects.toThrow('final inspection');
    });

    it('creates a Body & Paint invoice with split customer and insurer payable amounts', async () => {
      prismaMock.bodyPaintRepairOrder.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'READY_FOR_INVOICE',
        customer: { id: 'c-1', name: 'Alice' },
        vehicle: { id: 'v-1' },
        operations: [{ hours: 4, rate: 100 }],
        materials: [{ quantity: 2, unitCost: 50 }],
        insuranceCases: [],
        approvals: [{ type: 'INSURER', status: 'APPROVED', approvedAmount: 350 }],
        assessments: [],
      });
      prismaMock.invoiceReadySummary.upsert.mockResolvedValue({ laborTotal: 400, materialsTotal: 100, subtotal: 500, tax: 0, total: 500 });
      prismaMock.bodyPaintInvoice.findFirst.mockResolvedValue(null);
      prismaMock.bodyPaintInvoice.create.mockResolvedValue({ id: 'bpi-1', invoiceNo: 'INV-BP-1', status: 'READY', customerPayable: 150, insurerPayable: 350 });

      const invoice = await service.createInvoice('bp-1', 'advisor-1');
      expect(invoice.id).toBe('bpi-1');
      expect(prismaMock.bodyPaintRepairOrder.update).toHaveBeenCalledWith({ where: { id: 'bp-1' }, data: { status: 'INVOICED' } });
    });
  });
});
