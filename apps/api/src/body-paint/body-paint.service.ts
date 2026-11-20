import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApprovalDto,
  CreateRepairOrderDto,
  DamageAssessmentDto,
  InsuranceCaseDto,
  MaterialDto,
  MovementDto,
  OperationDto,
  UpdateOperationDto,
  FinalInspectionDto,
} from './dto/body-paint.dto';

export interface BodyPaintFilter {
  branchId?: string;
  customerId?: string;
  vehicleId?: string;
  status?: string;
}

@Injectable()
export class BodyPaintService {
  constructor(private readonly prisma: PrismaService) {}

  list(filter?: BodyPaintFilter | string) {
    const query = typeof filter === 'string' ? { branchId: filter } : (filter ?? {});
    const where: Prisma.BodyPaintRepairOrderWhereInput = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.status) where.status = query.status as any;

    return this.prisma.bodyPaintRepairOrder.findMany({
      where,
      include: {
        customer: true,
        vehicle: true,
        insuranceCases: true,
        operations: true,
        invoiceSummary: true,
        assessments: true,
        approvals: true,
        invoices: true,
        finalInspections: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getRepairOrder(id: string) {
    const order = await this.prisma.bodyPaintRepairOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        insuranceCases: { orderBy: { createdAt: 'desc' } },
        assessments: { include: { assessor: { select: { id: true, username: true } } }, orderBy: { assessedAt: 'desc' } },
        approvals: { orderBy: { approvedAt: 'desc' } },
        operations: { include: { technician: { select: { id: true, username: true } } }, orderBy: { id: 'desc' } },
        movements: {
          include: { fromLocation: true, toLocation: true, movedBy: { select: { id: true, username: true } } },
          orderBy: { movedAt: 'desc' },
        },
        materials: { include: { part: true, operation: true }, orderBy: { consumedAt: 'desc' } },
        invoiceSummary: true,
        invoices: { orderBy: { createdAt: 'desc' } },
        finalInspections: { orderBy: { inspectedAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('Body & Paint repair order not found');
    return order;
  }

  async getVehicleRepairHistory(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const orders = await this.prisma.bodyPaintRepairOrder.findMany({
      where: { vehicleId },
      include: {
        customer: true,
        insuranceCases: true,
        assessments: true,
        approvals: true,
        operations: true,
        materials: true,
        invoiceSummary: true,
        invoices: true,
      },
      orderBy: { openedAt: 'desc' },
    });
    const totalSpent = orders.reduce((sum, o) => sum + Number(o.invoiceSummary?.total ?? 0), 0);
    return {
      vehicle,
      totalOrders: orders.length,
      totalSpent,
      history: orders,
    };
  }

  async getCustomerRepairHistory(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    const orders = await this.prisma.bodyPaintRepairOrder.findMany({
      where: { customerId },
      include: {
        vehicle: true,
        insuranceCases: true,
        assessments: true,
        approvals: true,
        operations: true,
        materials: true,
        invoiceSummary: true,
        invoices: true,
      },
      orderBy: { openedAt: 'desc' },
    });
    const totalSpent = orders.reduce((sum, o) => sum + Number(o.invoiceSummary?.total ?? 0), 0);
    return {
      customer,
      totalOrders: orders.length,
      totalSpent,
      history: orders,
    };
  }

  listInsurance(id: string) {
    return this.prisma.insuranceCase.findMany({ where: { repairOrderId: id }, orderBy: { createdAt: 'desc' } });
  }

  listAssessments(id: string) {
    return this.prisma.damageAssessment.findMany({ where: { repairOrderId: id }, orderBy: { assessedAt: 'desc' } });
  }

  listApprovals(id: string) {
    return this.prisma.bodyPaintApproval.findMany({ where: { repairOrderId: id }, orderBy: { approvedAt: 'desc' } });
  }

  listOperations(id: string) {
    return this.prisma.bodyPaintOperation.findMany({
      where: { repairOrderId: id },
      include: { technician: { select: { id: true, username: true } } },
      orderBy: { id: 'desc' },
    });
  }

  listMovements(id: string) {
    return this.prisma.vehicleMovement.findMany({
      where: { repairOrderId: id },
      include: { fromLocation: true, toLocation: true },
      orderBy: { movedAt: 'desc' },
    });
  }

  listMaterials(id: string) {
    return this.prisma.materialConsumption.findMany({
      where: { repairOrderId: id },
      include: { part: true, operation: true },
      orderBy: { consumedAt: 'desc' },
    });
  }

  listFinalInspections(id: string) {
    return this.prisma.bodyPaintFinalInspection.findMany({
      where: { repairOrderId: id },
      include: { inspector: { select: { id: true, username: true } } },
      orderBy: { inspectedAt: 'desc' },
    });
  }

  async finalInspection(id: string, dto: FinalInspectionDto, actorId: string) {
    const order = await this.order(id);
    if (!['QUALITY_CHECK', 'INVOICED', 'READY_FOR_COLLECTION'].includes(order.status)) {
      throw new BadRequestException('Repair order must be in quality check or invoiced stage for final inspection');
    }
    return this.prisma.$transaction(async (tx) => {
      const inspection = await tx.bodyPaintFinalInspection.create({
        data: { repairOrderId: id, passed: dto.passed, checklist: dto.checklist as Prisma.InputJsonValue, notes: dto.notes, inspectorId: actorId },
        include: { inspector: { select: { id: true, username: true } } },
      });
      await tx.bodyPaintRepairOrder.update({
        where: { id },
        data: { status: dto.passed ? (order.status === 'INVOICED' ? 'READY_FOR_COLLECTION' : 'READY_FOR_INVOICE') : 'IN_PROGRESS' },
      });
      await this.audit(tx, actorId, 'FINAL_INSPECTION', 'BodyPaintFinalInspection', inspection.id, { passed: dto.passed });
      return inspection;
    });
  }

  async decideApproval(id: string, status: 'APPROVED' | 'REJECTED', notes: string | undefined, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const approval = await tx.bodyPaintApproval.findUnique({
        where: { id },
        include: { repairOrder: { select: { createdById: true } } },
      });
      if (!approval) throw new NotFoundException('Body & Paint approval not found');
      if (approval.repairOrder?.createdById === actorId) {
        throw new BadRequestException('The requester cannot decide their own Body & Paint approval');
      }
      const result = await tx.bodyPaintApproval.update({
        where: { id },
        data: { status, notes, approvedBy: actorId, approvedAt: status === 'APPROVED' ? new Date() : null },
      });
      if (status === 'APPROVED') {
        await tx.bodyPaintRepairOrder.update({ where: { id: approval.repairOrderId }, data: { status: 'APPROVED' } });
      }
      await this.audit(tx, actorId, 'DECISION', 'BodyPaintApproval', id, { status });
      return result;
    });
  }

  async create(dto: CreateRepairOrderDto, actorId: string) {
    const [customer, vehicle] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: dto.customerId } }),
      this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } }),
    ]);
    if (!customer) throw new BadRequestException('Customer not found');
    if (!vehicle) throw new BadRequestException('Vehicle not found');
    const branchId = customer.branchId || vehicle.branchId || dto.branchId;
    if (vehicle.customerId && vehicle.customerId !== customer.id) {
      throw new BadRequestException('Vehicle is registered under a different customer');
    }
    return this.prisma.$transaction(async (tx) => {
      if (!vehicle.customerId) {
        await tx.vehicle.update({ where: { id: vehicle.id }, data: { customerId: customer.id } });
      }
      const order = await tx.bodyPaintRepairOrder.create({
        data: {
          branchId,
          customerId: customer.id,
          vehicleId: vehicle.id,
          complaint: dto.complaint,
          orderNo: `BP-${randomUUID().slice(0, 8).toUpperCase()}`,
          createdById: actorId,
        },
        include: { customer: true, vehicle: true },
      });
      await this.audit(tx, actorId, 'CREATE', 'BodyPaintRepairOrder', order.id);
      return order;
    });
  }

  private async order(id: string) {
    const order = await this.prisma.bodyPaintRepairOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Body & Paint repair order not found');
    return order;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue
  ) {
    await tx.auditEvent.create({ data: { actorId, action, entityType, entityId, metadata } });
  }

  async insurance(id: string, dto: InsuranceCaseDto, actorId: string) {
    await this.order(id);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.insuranceCase.create({
        data: {
          repairOrderId: id,
          insurerName: dto.insurerName,
          policyNo: dto.policyNo,
          claimNo: dto.claimNo,
          status: (dto.status as any) || 'OPEN',
          approvedAmount: dto.approvedAmount === undefined ? undefined : new Prisma.Decimal(dto.approvedAmount),
          deductible: new Prisma.Decimal(dto.deductible ?? 0),
          notes: dto.notes,
        },
      });
      await this.audit(tx, actorId, 'CREATE', 'InsuranceCase', result.id);
      return result;
    });
  }

  async assessment(id: string, dto: DamageAssessmentDto, actorId: string) {
    await this.order(id);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.damageAssessment.create({
        data: {
          repairOrderId: id,
          assessorId: actorId,
          damageAreas: dto.damageAreas as Prisma.InputJsonValue,
          estimatedLabor: new Prisma.Decimal(dto.estimatedLabor ?? 0),
          estimatedMaterials: new Prisma.Decimal(dto.estimatedMaterials ?? 0),
          notes: dto.notes,
        },
      });
      await tx.bodyPaintRepairOrder.update({ where: { id }, data: { status: 'ASSESSMENT' } });
      await this.audit(tx, actorId, 'CREATE', 'DamageAssessment', result.id);
      return result;
    });
  }

  async approval(id: string, dto: ApprovalDto, actorId: string) {
    await this.order(id);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.bodyPaintApproval.create({
        data: {
          repairOrderId: id,
          type: dto.type as any,
          status: dto.status as any,
          approvedAmount: dto.approvedAmount === undefined ? undefined : new Prisma.Decimal(dto.approvedAmount),
          approvedBy: dto.approvedBy,
          approvedAt: dto.status === 'APPROVED' ? new Date() : undefined,
          notes: dto.notes,
        },
      });
      if (dto.status === 'APPROVED') {
        await tx.bodyPaintRepairOrder.update({ where: { id }, data: { status: 'APPROVED' } });
      }
      await this.audit(tx, actorId, 'APPROVAL', 'BodyPaintApproval', result.id, { type: dto.type, status: dto.status });
      return result;
    });
  }

  async operation(id: string, dto: OperationDto, actorId: string) {
    const order = await this.order(id);
    let technicianId = dto.technicianId;
    if (technicianId) {
      const tech = await this.prisma.user.findFirst({
        where: { OR: [{ id: technicianId }, { username: technicianId }], isActive: true },
        select: { id: true },
      });
      if (!tech) throw new BadRequestException('Technician not found');
      technicianId = tech.id;
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.bodyPaintOperation.create({
        data: {
          repairOrderId: id,
          type: dto.type as any,
          description: dto.description,
          status: (dto.status as any) || 'PLANNED',
          hours: new Prisma.Decimal(dto.hours ?? 0),
          rate: new Prisma.Decimal(dto.rate ?? 0),
          technicianId,
          startedAt: dto.status === 'IN_PROGRESS' ? new Date() : undefined,
          completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
        },
        include: { technician: { select: { id: true, username: true } } },
      });
      if ((order.status === 'OPEN' || order.status === 'APPROVED') && dto.status === 'IN_PROGRESS') {
        await tx.bodyPaintRepairOrder.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
      }
      await this.audit(tx, actorId, 'CREATE', 'BodyPaintOperation', result.id);
      return result;
    });
  }

  async updateOperation(id: string, dto: Partial<OperationDto>, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.bodyPaintOperation.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Body & Paint operation not found');
      let technicianId = dto.technicianId;
      if (technicianId) {
        const tech = await this.prisma.user.findFirst({
          where: { OR: [{ id: technicianId }, { username: technicianId }], isActive: true },
          select: { id: true },
        });
        if (!tech) throw new BadRequestException('Technician not found');
        technicianId = tech.id;
      }
      const result = await tx.bodyPaintOperation.update({
        where: { id },
        data: {
          type: dto.type as any,
          description: dto.description,
          status: dto.status as any,
          hours: dto.hours === undefined ? undefined : new Prisma.Decimal(dto.hours),
          rate: dto.rate === undefined ? undefined : new Prisma.Decimal(dto.rate),
          technicianId,
          startedAt: dto.status === 'IN_PROGRESS' ? new Date() : undefined,
          completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
        },
      });
      await this.audit(tx, actorId, 'UPDATE', 'BodyPaintOperation', id, { status: dto.status });
      return result;
    });
  }

  async movement(id: string, dto: MovementDto, actorId: string) {
    const order = await this.order(id);
    const rawLocs = [dto.fromLocationId, dto.toLocationId].filter(Boolean) as string[];
    let resolvedFromId = dto.fromLocationId;
    let resolvedToId = dto.toLocationId;

    if (rawLocs.length) {
      const locations = await this.prisma.location.findMany({
        where: {
          OR: [{ id: { in: rawLocs } }, { code: { in: rawLocs } }],
          branchId: order.branchId,
        },
        select: { id: true, code: true },
      });
      const locMap = new Map<string, string>();
      for (const l of locations) {
        locMap.set(l.id, l.id);
        locMap.set(l.code, l.id);
      }
      if (dto.fromLocationId && locMap.has(dto.fromLocationId)) {
        resolvedFromId = locMap.get(dto.fromLocationId);
      }
      if (dto.toLocationId && locMap.has(dto.toLocationId)) {
        resolvedToId = locMap.get(dto.toLocationId);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.vehicleMovement.create({
        data: {
          repairOrderId: id,
          fromLocationId: resolvedFromId,
          toLocationId: resolvedToId,
          movedById: actorId,
          notes: dto.notes,
        },
        include: { fromLocation: true, toLocation: true, movedBy: { select: { id: true, username: true } } },
      });
      await this.audit(tx, actorId, 'MOVE', 'VehicleMovement', result.id);
      return result;
    });
  }

  async material(id: string, dto: MaterialDto, actorId: string) {
    await this.order(id);
    const part = await this.prisma.part.findFirst({
      where: {
        OR: [{ id: dto.partId }, { code: dto.partId }],
        isActive: true,
      },
    });
    if (!part) throw new BadRequestException('Part not found or inactive');
    if (
      dto.operationId &&
      !(await this.prisma.bodyPaintOperation.findFirst({ where: { id: dto.operationId, repairOrderId: id } }))
    ) {
      throw new BadRequestException('Operation does not belong to this repair order');
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.materialConsumption.create({
        data: {
          repairOrderId: id,
          partId: part.id,
          operationId: dto.operationId,
          quantity: new Prisma.Decimal(dto.quantity),
          unitCost: new Prisma.Decimal(dto.unitCost ?? 0),
        },
        include: { part: true, operation: true },
      });
      await this.audit(tx, actorId, 'CONSUME', 'MaterialConsumption', result.id, { partId: part.id, quantity: dto.quantity });
      return result;
    });
  }

  async status(id: string, status: string, actorId: string) {
    const current = await this.order(id);
    if (status === 'CLOSED') return this.deliver(id, actorId);
    if (status === 'READY_FOR_COLLECTION') {
      const [inspection, invoice] = await Promise.all([
        this.prisma.bodyPaintFinalInspection.findFirst({ where: { repairOrderId: id, passed: true }, orderBy: { inspectedAt: 'desc' } }),
        this.prisma.bodyPaintInvoice.findFirst({ where: { repairOrderId: id, status: { in: ['POSTED', 'PAID'] } }, orderBy: { createdAt: 'desc' } }),
      ]);
      if (!inspection) throw new BadRequestException('A passed final inspection is required before collection');
      if (!invoice) throw new BadRequestException('A posted Body & Paint invoice is required before collection');
    }
    const allowedTransitions: Record<string, string[]> = {
      OPEN: ['ASSESSMENT', 'PENDING_APPROVAL', 'CANCELLED'],
      ASSESSMENT: ['PENDING_APPROVAL', 'CANCELLED'],
      PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
      APPROVED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['QUALITY_CHECK', 'CANCELLED'],
      QUALITY_CHECK: ['READY_FOR_INVOICE', 'IN_PROGRESS', 'CANCELLED'],
      READY_FOR_INVOICE: ['INVOICED', 'IN_PROGRESS', 'CANCELLED'],
      INVOICED: ['READY_FOR_COLLECTION'],
      READY_FOR_COLLECTION: ['CLOSED'],
      CLOSED: ['CLOSED'],
      CANCELLED: ['CANCELLED'],
    };
    if (!allowedTransitions[current.status]?.includes(status)) {
      throw new BadRequestException(`Invalid repair order transition from ${current.status} to ${status}`);
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.bodyPaintRepairOrder.update({
        where: { id },
        data: { status: status as any, closedAt: status === 'CLOSED' ? new Date() : undefined },
      });
      await this.audit(tx, actorId, 'STATUS', 'BodyPaintRepairOrder', id, { status });
      return result;
    });
  }

  async invoiceReady(id: string) {
    const order = await this.prisma.bodyPaintRepairOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        operations: true,
        materials: { include: { part: true, operation: true } },
        insuranceCases: true,
        approvals: true,
        assessments: true,
      },
    });
    if (!order) throw new NotFoundException('Body & Paint repair order not found');
    const laborTotal = order.operations.reduce(
      (sum, op) => sum.plus(new Prisma.Decimal(op.hours).times(op.rate)),
      new Prisma.Decimal(0)
    );
    const materialsTotal = order.materials.reduce(
      (sum, material) => sum.plus(new Prisma.Decimal(material.quantity).times(material.unitCost)),
      new Prisma.Decimal(0)
    );
    const subtotal = laborTotal.plus(materialsTotal);
    const summary = await this.prisma.invoiceReadySummary.upsert({
      where: { repairOrderId: id },
      update: { laborTotal, materialsTotal, subtotal, total: subtotal, generatedAt: new Date() },
      create: { repairOrderId: id, laborTotal, materialsTotal, subtotal, total: subtotal },
    });

    const approvedInsurerApproval = order.approvals.find((a) => a.type === 'INSURER' && a.status === 'APPROVED');
    const insurerPayable = approvedInsurerApproval?.approvedAmount
      ? Prisma.Decimal.min(subtotal, approvedInsurerApproval.approvedAmount)
      : new Prisma.Decimal(0);
    const customerPayable = subtotal.minus(insurerPayable);

    return {
      ...summary,
      customer: order.customer,
      vehicle: order.vehicle,
      operations: order.operations,
      materials: order.materials,
      insuranceCases: order.insuranceCases,
      approvals: order.approvals,
      assessments: order.assessments,
      insurerPayable,
      customerPayable,
    };
  }

  async createInvoice(id: string, actorId: string) {
    const summary = await this.invoiceReady(id);
    const existing = await this.prisma.bodyPaintInvoice.findFirst({ where: { repairOrderId: id, status: { in: ['READY', 'POSTED', 'PAID'] } } });
    if (existing) return existing;
    if (!['READY_FOR_INVOICE', 'INVOICED', 'READY_FOR_COLLECTION'].includes((await this.order(id)).status)) {
      throw new BadRequestException('Repair order must pass final inspection before invoicing');
    }
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.bodyPaintInvoice.create({
        data: {
          repairOrderId: id,
          invoiceNo: `INV-BP-${randomUUID().slice(0, 8).toUpperCase()}`,
          laborTotal: summary.laborTotal,
          materialsTotal: summary.materialsTotal,
          subtotal: summary.subtotal,
          tax: summary.tax,
          total: summary.total,
          insurerPayable: summary.insurerPayable,
          customerPayable: summary.customerPayable,
          createdById: actorId,
        },
      });
      await tx.bodyPaintRepairOrder.update({ where: { id }, data: { status: 'INVOICED' } });
      await this.audit(tx, actorId, 'CREATE', 'BodyPaintInvoice', invoice.id, { invoiceNo: invoice.invoiceNo });
      return invoice;
    });
  }

  listInvoices(query?: { branchId?: string; repairOrderId?: string; status?: string }) {
    const where: Prisma.BodyPaintInvoiceWhereInput = {};
    if (query?.repairOrderId) where.repairOrderId = query.repairOrderId;
    if (query?.status) where.status = query.status as any;
    if (query?.branchId) where.repairOrder = { branchId: query.branchId };
    return this.prisma.bodyPaintInvoice.findMany({ where, include: { repairOrder: { include: { customer: true, vehicle: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async postInvoice(invoiceId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.bodyPaintInvoice.findUnique({ where: { id: invoiceId }, include: { repairOrder: true } });
      if (!invoice) throw new NotFoundException('Body & Paint invoice not found');
      if (invoice.status === 'POSTED' || invoice.status === 'PAID') return invoice;
      const [ar, serviceRevenue, partsRevenue, period] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { code: '1100', isActive: true } }),
        tx.chartOfAccount.findFirst({ where: { code: '4100', isActive: true } }),
        tx.chartOfAccount.findFirst({ where: { code: '4200', isActive: true } }),
        tx.fiscalPeriod.findFirst({ where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } } }),
      ]);
      if (!ar || !serviceRevenue || !partsRevenue || !period) throw new BadRequestException('Body & Paint posting requires AR, revenue accounts, and an open fiscal period');
      const total = new Prisma.Decimal(invoice.total);
      const customerAmount = new Prisma.Decimal(invoice.customerPayable);
      const insurerAmount = new Prisma.Decimal(invoice.insurerPayable);
      const documents: Array<{ amount: Prisma.Decimal; sourceType: string; suffix: string; customerId?: string | null }> = [];
      if (customerAmount.gt(0)) documents.push({ amount: customerAmount, sourceType: 'BODY_PAINT_CUSTOMER', suffix: 'CUST', customerId: invoice.repairOrder.customerId });
      if (insurerAmount.gt(0)) documents.push({ amount: insurerAmount, sourceType: 'BODY_PAINT_INSURER', suffix: 'INS', customerId: null });
      for (const doc of documents) {
        const financeDocument = await tx.financeDocument.create({ data: { documentNo: `${invoice.invoiceNo}-${doc.suffix}`, type: 'RECEIVABLE', sourceType: doc.sourceType, sourceId: invoice.id, amount: doc.amount, createdById: actorId } });
        await tx.receivable.create({ data: { documentId: financeDocument.id, customerId: doc.customerId, dueDate: new Date(Date.now() + 30 * 86400000), amount: doc.amount, outstanding: doc.amount, status: 'OPEN' } });
      }
      const journal = await tx.journalEntry.create({
        data: {
          fiscalPeriodId: period.id,
          entryDate: new Date(),
          description: `Body & Paint invoice ${invoice.invoiceNo}`,
          sourceType: 'BODY_PAINT_INVOICE',
          sourceId: invoice.id,
          status: 'POSTED',
          postedAt: new Date(),
          createdById: actorId,
          lines: { create: [
            { accountId: ar.id, debit: total, credit: 0, description: `AR ${invoice.invoiceNo}` },
            { accountId: serviceRevenue.id, debit: 0, credit: invoice.laborTotal, description: `Body labor ${invoice.invoiceNo}` },
            { accountId: partsRevenue.id, debit: 0, credit: invoice.materialsTotal, description: `Body paint materials ${invoice.invoiceNo}` },
          ] },
        },
      });
      const updated = await tx.bodyPaintInvoice.update({ where: { id: invoiceId }, data: { status: 'POSTED', postedAt: new Date(), journalEntryId: journal.id } });
      await tx.bodyPaintRepairOrder.update({ where: { id: invoice.repairOrderId }, data: { status: 'INVOICED' } });
      await this.audit(tx, actorId, 'POST', 'BodyPaintInvoice', invoiceId, { journalEntryId: journal.id, total: total.toString() });
      return updated;
    });
  }

  async deliver(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.bodyPaintRepairOrder.findUnique({ where: { id }, include: { invoices: true, finalInspections: { orderBy: { inspectedAt: 'desc' }, take: 1 } } });
      if (!order) throw new NotFoundException('Body & Paint repair order not found');
      const invoice = order.invoices.find((item) => item.status === 'POSTED' || item.status === 'PAID');
      if (!invoice) throw new BadRequestException('A posted Body & Paint invoice is required before delivery');
      if (!order.finalInspections[0]?.passed) throw new BadRequestException('A passed final inspection is required before delivery');
      const receivables = await tx.receivable.findMany({ where: { document: { sourceId: invoice.id, sourceType: { in: ['BODY_PAINT_CUSTOMER', 'BODY_PAINT_INSURER'] } } } });
      if (receivables.some((item) => item.outstanding.gt(0))) throw new BadRequestException('Outstanding Body & Paint receivables must be settled before delivery');
      const updated = await tx.bodyPaintRepairOrder.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
      await this.audit(tx, actorId, 'DELIVER', 'BodyPaintRepairOrder', id, { invoiceId: invoice.id });
      return updated;
    });
  }

  async reports(filter?: { branchId?: string; from?: string; to?: string }) {
    const date = filter?.from || filter?.to ? { gte: filter.from ? new Date(filter.from) : undefined, lte: filter.to ? new Date(filter.to) : undefined } : undefined;
    const orderWhere: Prisma.BodyPaintRepairOrderWhereInput = { ...(filter?.branchId ? { branchId: filter.branchId } : {}), ...(date ? { openedAt: date } : {}) };
    const [byStatus, revenue, labor, materials, technicianLoad, pending] = await Promise.all([
      this.prisma.bodyPaintRepairOrder.groupBy({ by: ['status'], where: orderWhere, _count: { _all: true } }),
      this.prisma.bodyPaintInvoice.aggregate({ where: { status: { in: ['POSTED', 'PAID'] }, ...(filter?.branchId ? { repairOrder: { branchId: filter.branchId } } : {}), ...(date ? { createdAt: date } : {}) }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.bodyPaintOperation.aggregate({ where: { ...(date ? { startedAt: date } : {}), ...(filter?.branchId ? { repairOrder: { branchId: filter.branchId } } : {}) }, _sum: { hours: true } }),
      this.prisma.materialConsumption.aggregate({ where: { ...(date ? { consumedAt: date } : {}), ...(filter?.branchId ? { repairOrder: { branchId: filter.branchId } } : {}) }, _sum: { quantity: true, unitCost: true } }),
      this.prisma.user.findMany({ where: { bodyPaintOperations: { some: { repairOrder: orderWhere } } }, select: { id: true, username: true, _count: { select: { bodyPaintOperations: true } } } }),
      this.prisma.bodyPaintRepairOrder.count({ where: { ...orderWhere, status: { in: ['OPEN', 'ASSESSMENT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_INVOICE', 'INVOICED', 'READY_FOR_COLLECTION'] } } }),
    ]);
    return { filter, byStatus, revenue: Number(revenue._sum.total || 0), invoiceCount: revenue._count._all, laborHours: Number(labor._sum.hours || 0), materialQuantity: Number(materials._sum.quantity || 0), pendingWork: pending, technicianLoad };
  }
}
