import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { InventoryService } from '../inventory/inventory.service';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstimateDto, CreateJobCardDto, InspectionDto, RecordLaborDto, RequestPartsDto, AssignTechnicianDto, CreateServicePackageDto, ServiceCheckEventDto } from './dto/service.dto';

export interface JobCardFilter {
  branchId?: string;
  customerId?: string;
  vehicleId?: string;
  status?: string;
}

@Injectable()
export class ServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly finance: FinanceService
  ) {}

  listJobCards(filter?: JobCardFilter | string) {
    const query: JobCardFilter = typeof filter === 'string' ? { branchId: filter } : (filter ?? {});
    const where: Prisma.JobCardWhereInput = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.status) where.status = query.status as any;

    return this.prisma.jobCard.findMany({
      where,
      include: {
        customer: true,
        vehicle: true,
        package: true,
        assignments: {
          where: { releasedAt: null },
          include: { technician: { select: { id: true, username: true } } },
        },
        estimates: {
          include: { lines: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        invoices: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getJobCard(id: string) {
    const job = await this.prisma.jobCard.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        package: true,
        assignments: {
          include: { technician: { select: { id: true, username: true } } },
          orderBy: { assignedAt: 'desc' },
        },
        estimates: {
          include: { lines: { include: { part: true } }, approvedBy: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'desc' },
        },
        labor: {
          include: { technician: { select: { id: true, username: true } } },
          orderBy: { performedAt: 'desc' },
        },
        partsRequests: {
          include: { lines: { include: { part: true } } },
          orderBy: { createdAt: 'desc' },
        },
        inspections: {
          include: { inspector: { select: { id: true, username: true } } },
          orderBy: { inspectedAt: 'desc' },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
        checkEvents: {
          orderBy: { eventAt: 'asc' },
        },
      },
    });
    if (!job) throw new NotFoundException('Job card not found');
    return job;
  }

  async getVehicleServiceHistory(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const jobCards = await this.prisma.jobCard.findMany({
      where: { vehicleId },
      include: {
        customer: true,
        assignments: { include: { technician: { select: { id: true, username: true } } } },
        estimates: { include: { lines: true } },
        labor: true,
        inspections: true,
        invoices: true,
      },
      orderBy: { openedAt: 'desc' },
    });
    const totalSpent = jobCards.reduce((sum, jc) => {
      const invTotal = jc.invoices.reduce((s, inv) => s + Number(inv.total), 0);
      return sum + invTotal;
    }, 0);
    return {
      vehicle,
      totalJobCards: jobCards.length,
      totalSpent,
      history: jobCards,
    };
  }

  async getCustomerServiceHistory(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    const jobCards = await this.prisma.jobCard.findMany({
      where: { customerId },
      include: {
        vehicle: true,
        package: true,
        assignments: { include: { technician: { select: { id: true, username: true } } } },
        estimates: { include: { lines: true } },
        labor: true,
        inspections: true,
        invoices: true,
      },
      orderBy: { openedAt: 'desc' },
    });
    const totalSpent = jobCards.reduce((sum, jc) => {
      const invTotal = jc.invoices.reduce((s, inv) => s + Number(inv.total), 0);
      return sum + invTotal;
    }, 0);
    return {
      customer,
      totalJobCards: jobCards.length,
      totalSpent,
      history: jobCards,
    };
  }

  async createJobCard(dto: CreateJobCardDto, actorId: string) {
    const [customer, vehicle] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: dto.customerId } }),
      this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } }),
    ]);
    if (!customer) throw new BadRequestException('Customer not found');
    if (!vehicle) throw new BadRequestException('Vehicle not found');
    if (dto.packageId) {
      const servicePackage = await this.prisma.servicePackage.findFirst({ where: { id: dto.packageId, status: 'ACTIVE' } });
      if (!servicePackage) throw new BadRequestException('Service package not found or inactive');
    }
    const branchId = customer.branchId || vehicle.branchId || dto.branchId;
    if (vehicle.customerId && vehicle.customerId !== customer.id) {
      throw new BadRequestException('Vehicle is registered under a different customer');
    }
    const jobNo = `JC-${randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      if (!vehicle.customerId) {
        await tx.vehicle.update({ where: { id: vehicle.id }, data: { customerId: customer.id } });
      }
      const job = await tx.jobCard.create({
        data: {
          branchId,
          customerId: customer.id,
          vehicleId: vehicle.id,
          complaint: dto.complaint,
          odometer: dto.odometer,
          packageId: dto.packageId,
          isWarranty: dto.isWarranty ?? false,
          warrantyRef: dto.warrantyRef,
          jobNo,
          createdById: actorId,
        },
        include: { customer: true, vehicle: true },
      });
      await tx.auditEvent.create({
        data: { actorId, action: 'CREATE', entityType: 'JobCard', entityId: job.id, metadata: { jobNo } },
      });
      return job;
    });
  }

  listPackages() {
    return this.prisma.servicePackage.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } });
  }

  async createPackage(dto: CreateServicePackageDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.servicePackage.create({ data: { code: dto.code.trim().toUpperCase(), name: dto.name.trim(), description: dto.description, price: new Prisma.Decimal(dto.price), createdById: actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'ServicePackage', entityId: item.id, metadata: { code: item.code } } });
      return item;
    });
  }

  async recordCheckEvent(jobCardId: string, dto: ServiceCheckEventDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.jobCard.findUnique({ where: { id: jobCardId } });
      if (!job) throw new NotFoundException('Job card not found');
      if (dto.type === 'CHECK_OUT' && !['READY_FOR_INVOICE', 'INVOICED', 'CLOSED'].includes(job.status)) throw new BadRequestException('Job must pass final inspection before check-out');
      const event = await tx.serviceCheckEvent.create({ data: { jobCardId, type: dto.type as any, odometer: dto.odometer, fuelLevel: dto.fuelLevel, checklist: dto.checklist as Prisma.InputJsonValue | undefined, notes: dto.notes, createdById: actorId } });
      if (dto.type === 'CHECK_OUT' && job.status === 'INVOICED') {
        await tx.jobCard.update({ where: { id: jobCardId }, data: { status: 'CLOSED', closedAt: new Date() } });
      }
      await tx.auditEvent.create({ data: { actorId, action: dto.type, entityType: 'ServiceCheckEvent', entityId: event.id, metadata: { jobCardId } } });
      return event;
    });
  }

  listCheckEvents(jobCardId: string) {
    return this.prisma.serviceCheckEvent.findMany({ where: { jobCardId }, orderBy: { eventAt: 'asc' } });
  }

  async serviceReports(filter?: { branchId?: string; from?: string; to?: string }) {
    const date = filter?.from || filter?.to ? { gte: filter.from ? new Date(filter.from) : undefined, lte: filter.to ? new Date(filter.to) : undefined } : undefined;
    const where: Prisma.JobCardWhereInput = { ...(filter?.branchId ? { branchId: filter.branchId } : {}), ...(date ? { openedAt: date } : {}) };
    const [byStatus, revenue, laborHours, technicianLoad, pending] = await Promise.all([
      this.prisma.jobCard.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.serviceInvoice.aggregate({ where: { status: { in: ['POSTED', 'PAID'] }, ...(filter?.branchId ? { jobCard: { branchId: filter.branchId } } : {}), ...(date ? { createdAt: date } : {}) }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.laborOperation.aggregate({ where: { ...(date ? { performedAt: date } : {}), ...(filter?.branchId ? { jobCard: { branchId: filter.branchId } } : {}) }, _sum: { hours: true } }),
      this.prisma.user.findMany({ where: { technicianAssignments: { some: { jobCard: where } } }, select: { id: true, username: true, _count: { select: { technicianAssignments: true, laborOperations: true } } } }),
      this.prisma.jobCard.count({ where: { ...where, status: { in: ['OPEN', 'ESTIMATED', 'APPROVED', 'IN_PROGRESS', 'WAITING_PARTS', 'QUALITY_CHECK', 'READY_FOR_INVOICE'] } } }),
    ]);
    return { filter, byStatus, revenue: Number(revenue._sum.total || 0), invoiceCount: revenue._count._all, laborHours: Number(laborHours._sum.hours || 0), pendingWork: pending, technicianLoad };
  }

  async createEstimate(jobCardId: string, dto: CreateEstimateDto, actorId: string) {
    const job = await this.prisma.jobCard.findUnique({ where: { id: jobCardId } });
    if (!job) throw new NotFoundException('Job card not found');

    const rawPartIds = dto.lines.filter((l) => l.partId).map((l) => l.partId!);
    const resolvedLines = dto.lines.map((l) => ({ ...l }));
    if (rawPartIds.length) {
      const parts = await this.prisma.part.findMany({
        where: {
          OR: [{ id: { in: rawPartIds } }, { code: { in: rawPartIds } }],
          isActive: true,
        },
      });
      const partMap = new Map<string, string>();
      for (const p of parts) {
        partMap.set(p.id, p.id);
        partMap.set(p.code, p.id);
      }
      for (const line of resolvedLines) {
        if (line.partId) {
          const resolvedId = partMap.get(line.partId);
          if (!resolvedId) throw new BadRequestException(`Estimate part ${line.partId} must be active`);
          line.partId = resolvedId;
        }
      }
    }

    const estimateNo = `EST-${randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const estimate = await tx.estimate.create({
        data: {
          jobCardId,
          estimateNo,
          status: 'PENDING_APPROVAL',
          notes: dto.notes,
          lines: {
            create: resolvedLines.map((l) => ({
              description: l.description,
              quantity: new Prisma.Decimal(l.quantity),
              unitPrice: new Prisma.Decimal(l.unitPrice),
              lineType: l.lineType,
              partId: l.partId,
            })),
          },
        },
        include: { lines: true },
      });
      await tx.jobCard.update({ where: { id: jobCardId }, data: { status: 'ESTIMATED' } });
      await tx.auditEvent.create({
        data: { actorId, action: 'CREATE', entityType: 'Estimate', entityId: estimate.id, metadata: { estimateNo } },
      });
      return estimate;
    });
  }

  async approveEstimate(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const estimate = await tx.estimate.findUnique({
        where: { id },
        include: { jobCard: { select: { createdById: true } } },
      });
      if (!estimate) throw new NotFoundException('Estimate not found');
      if (estimate.status !== 'PENDING_APPROVAL') throw new BadRequestException('Estimate is not awaiting approval');
      if (estimate.jobCard?.createdById === actorId) {
        throw new BadRequestException('The requester cannot approve their own estimate');
      }
      const result = await tx.estimate.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedById: actorId },
        include: { lines: true },
      });
      await tx.jobCard.update({ where: { id: estimate.jobCardId }, data: { status: 'APPROVED' } });
      await tx.auditEvent.create({ data: { actorId, action: 'APPROVE', entityType: 'Estimate', entityId: id } });
      return result;
    });
  }

  async assignTechnician(jobCardId: string, dto: AssignTechnicianDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.jobCard.findUnique({ where: { id: jobCardId }, select: { id: true, status: true } });
      if (!job) throw new NotFoundException('Job card not found');
      const tech = await tx.user.findFirst({
        where: {
          OR: [{ id: dto.technicianId }, { username: dto.technicianId }],
          isActive: true,
        },
        select: { id: true, username: true },
      });
      if (!tech) throw new BadRequestException('Technician not found');

      await tx.technicianAssignment.updateMany({
        where: { jobCardId, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      const a = await tx.technicianAssignment.create({
        data: { jobCardId, technicianId: tech.id },
        include: { technician: { select: { id: true, username: true } } },
      });

      if (job.status === 'OPEN' || job.status === 'APPROVED') {
        await tx.jobCard.update({ where: { id: jobCardId }, data: { status: 'IN_PROGRESS' } });
      }

      await tx.auditEvent.create({
        data: { actorId, action: 'ASSIGN', entityType: 'TechnicianAssignment', entityId: a.id, metadata: { technicianId: tech.id } },
      });
      return a;
    });
  }

  async requestParts(jobCardId: string, dto: RequestPartsDto, actorId: string) {
    const job = await this.prisma.jobCard.findUnique({ where: { id: jobCardId } });
    if (!job) throw new NotFoundException('Job card not found');

    const location = await this.prisma.location.findFirst({
      where: {
        OR: [{ id: dto.locationId }, { code: dto.locationId, branchId: job.branchId }],
        branchId: job.branchId,
      },
    });
    if (!location) throw new BadRequestException('Location must belong to the job card branch');

    const rawIds = dto.lines.map((l) => l.partId);
    if (!dto.lines.length) throw new BadRequestException('At least one part must be requested');
    const parts = await this.prisma.part.findMany({
      where: {
        OR: [{ id: { in: rawIds } }, { code: { in: rawIds } }],
        isActive: true,
      },
    });
    const partMap = new Map<string, string>();
    for (const p of parts) {
      partMap.set(p.id, p.id);
      partMap.set(p.code, p.id);
    }
    const linesToCreate = dto.lines.map((l) => {
      const resolvedPartId = partMap.get(l.partId);
      if (!resolvedPartId) throw new BadRequestException(`Every requested part must be active: ${l.partId}`);
      return {
        partId: resolvedPartId,
        quantity: new Prisma.Decimal(l.quantity),
      };
    });

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.partsRequest.create({
        data: {
          requestNo: `PRQ-${randomUUID().slice(0, 8).toUpperCase()}`,
          branchId: job.branchId,
          requestedById: actorId,
          jobCardId,
          lines: {
            create: linesToCreate,
          },
        },
        include: { lines: { include: { part: true } } },
      });
      await tx.jobCard.update({ where: { id: jobCardId }, data: { status: 'WAITING_PARTS' } });
      await tx.auditEvent.create({
        data: { actorId, action: 'REQUEST', entityType: 'PartsRequest', entityId: request.id, metadata: { jobCardId, locationId: location.id } },
      });
      return request;
    });
  }

  async recordLabor(jobCardId: string, dto: RecordLaborDto, actorId: string) {
    const job = await this.prisma.jobCard.findUnique({ where: { id: jobCardId }, select: { id: true, status: true } });
    if (!job) throw new NotFoundException('Job card not found');
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
      const labor = await tx.laborOperation.create({
        data: {
          jobCardId,
          technicianId,
          description: dto.description,
          hours: new Prisma.Decimal(dto.hours),
          rate: new Prisma.Decimal(dto.rate),
        },
        include: { technician: { select: { id: true, username: true } } },
      });
      if (job.status === 'OPEN' || job.status === 'APPROVED' || job.status === 'WAITING_PARTS') {
        await tx.jobCard.update({ where: { id: jobCardId }, data: { status: 'IN_PROGRESS' } });
      }
      await tx.auditEvent.create({ data: { actorId, action: 'RECORD', entityType: 'LaborOperation', entityId: labor.id } });
      return labor;
    });
  }

  async updateStatus(jobCardId: string, status: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.jobCard.findUnique({
        where: { id: jobCardId },
        include: {
          estimates: { where: { status: 'APPROVED' }, include: { lines: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          labor: true,
        },
      });
      if (!job) throw new NotFoundException('Job card not found');
      if (job.status) {
        const allowedTransitions: Record<string, string[]> = {
          OPEN: ['ESTIMATED', 'CANCELLED'],
          ESTIMATED: ['APPROVED', 'CANCELLED'],
          APPROVED: ['IN_PROGRESS', 'WAITING_PARTS', 'CANCELLED'],
          IN_PROGRESS: ['WAITING_PARTS', 'QUALITY_CHECK', 'CANCELLED'],
          WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
          QUALITY_CHECK: ['READY_FOR_INVOICE', 'IN_PROGRESS', 'CANCELLED'],
          READY_FOR_INVOICE: ['INVOICED', 'IN_PROGRESS', 'CANCELLED'],
          INVOICED: ['CLOSED'],
          CLOSED: ['CLOSED'],
          CANCELLED: ['CANCELLED'],
        };
        if (!allowedTransitions[job.status]?.includes(status)) {
          throw new BadRequestException(`Invalid job card transition from ${job.status} to ${status}`);
        }
      }
      if (status === 'INVOICED') {
        const existingInvoice = await tx.serviceInvoice.findFirst({ where: { jobCardId } });
        if (!existingInvoice) {
          const summary = await this.invoiceReadySummary(jobCardId);
          const invoice = await tx.serviceInvoice.create({
            data: {
              jobCardId,
              invoiceNo: `INV-SVC-${randomUUID().slice(0, 8).toUpperCase()}`,
              status: 'READY',
              subtotal: summary.subtotal,
              total: summary.total,
              tax: 0,
            },
          });
          await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'ServiceInvoice', entityId: invoice.id } });
        }
      }
      const updated = await tx.jobCard.update({
        where: { id: jobCardId },
        data: { status: status as any, closedAt: status === 'CLOSED' ? new Date() : undefined },
      });
      await tx.auditEvent.create({ data: { actorId, action: 'STATUS', entityType: 'JobCard', entityId: jobCardId, metadata: { status } } });
      return updated;
    });
  }

  async recordInspection(jobCardId: string, dto: InspectionDto, actorId: string) {
    if (!(await this.prisma.jobCard.findUnique({ where: { id: jobCardId }, select: { id: true } }))) {
      throw new NotFoundException('Job card not found');
    }
    return this.prisma.$transaction(async (tx) => {
      const inspection = await tx.inspection.create({
        data: {
          jobCardId,
          inspectorId: actorId,
          checklist: dto.checklist as Prisma.InputJsonValue,
          passed: dto.passed,
          notes: dto.notes,
        },
      });
      await tx.jobCard.update({ where: { id: jobCardId }, data: { status: dto.passed ? 'READY_FOR_INVOICE' : 'IN_PROGRESS' } });
      await tx.auditEvent.create({ data: { actorId, action: 'INSPECT', entityType: 'Inspection', entityId: inspection.id, metadata: { passed: dto.passed } } });
      return inspection;
    });
  }

  async invoiceReadySummary(jobCardId: string) {
    const job = await this.prisma.jobCard.findUnique({
      where: { id: jobCardId },
      include: {
        customer: true,
        vehicle: true,
        labor: true,
        estimates: { where: { status: 'APPROVED' }, include: { lines: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        partsRequests: { include: { lines: { include: { part: true } } } },
      },
    });
    if (!job) throw new NotFoundException('Job card not found');
    const estimateLines = job.estimates[0]?.lines ?? [];
    const labor = job.labor.reduce((s, l) => s.plus(new Prisma.Decimal(l.hours).times(l.rate)), new Prisma.Decimal(0));
    const parts = estimateLines
      .filter((l) => l.lineType === 'PART')
      .reduce((s, l) => s.plus(new Prisma.Decimal(l.quantity).times(l.unitPrice)), new Prisma.Decimal(0));
    const other = estimateLines
      .filter((l) => l.lineType !== 'PART' && l.lineType !== 'LABOR')
      .reduce((s, l) => s.plus(new Prisma.Decimal(l.quantity).times(l.unitPrice)), new Prisma.Decimal(0));
    const subtotal = labor.plus(parts).plus(other);
    return {
      jobCardId,
      customer: job.customer,
      vehicle: job.vehicle,
      subtotal,
      tax: new Prisma.Decimal(0),
      total: subtotal,
      traceablePartsRequests: job.partsRequests,
    };
  }

  async listInvoices(query?: { branchId?: string; jobCardId?: string; status?: string }) {
    const where: Prisma.ServiceInvoiceWhereInput = {};
    if (query?.jobCardId) where.jobCardId = query.jobCardId;
    if (query?.status) where.status = query.status as any;
    if (query?.branchId) where.jobCard = { branchId: query.branchId };
    return this.prisma.serviceInvoice.findMany({
      where,
      include: {
        jobCard: {
          include: {
            customer: true,
            vehicle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async postServiceInvoice(invoiceId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.serviceInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          jobCard: {
            include: { customer: true, vehicle: true, branch: true },
          },
        },
      });
      if (!invoice) throw new NotFoundException('Service invoice not found');
      if (invoice.status === 'POSTED') return invoice;

      const [arAccount, revAccount] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { code: '1100', isActive: true } }),
        tx.chartOfAccount.findFirst({ where: { code: '4100', isActive: true } }),
      ]);
      const period = await tx.fiscalPeriod.findFirst({
        where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } },
      });
      if (!arAccount || !revAccount || !period) throw new BadRequestException('Service posting requires AR, service revenue, and an open fiscal period');

      const amount = Number(invoice.total);
      if (amount > 0) {
        {
           const entry = await tx.journalEntry.create({
            data: {
              fiscalPeriodId: period.id,
              entryDate: new Date(),
              description: `Service Invoice ${invoice.invoiceNo} for Job ${invoice.jobCard.jobNo} (${invoice.jobCard.customer.name})`,
              sourceType: 'ServiceInvoice',
              sourceId: invoice.id,
              createdById: actorId,
              status: 'POSTED',
              postedAt: new Date(),
              lines: {
                create: [
                  { accountId: arAccount.id, debit: new Prisma.Decimal(amount), credit: new Prisma.Decimal(0), description: `Receivable from ${invoice.jobCard.customer.name}` },
                  { accountId: revAccount.id, debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(amount), description: `Workshop Service Revenue - ${invoice.jobCard.jobNo}` },
                ],
              },
             },
           });
      const financeDocument = await tx.financeDocument.create({
             data: {
               documentNo: invoice.invoiceNo,
               type: 'RECEIVABLE',
               sourceType: 'ServiceInvoice',
               sourceId: invoice.id,
        amount: invoice.total,
               journalEntryId: entry.id,
               createdById: actorId,
             },
           });
      await tx.receivable.create({
             data: {
               documentId: financeDocument.id,
               customerId: invoice.jobCard.customerId,
               dueDate: new Date(Date.now() + 30 * 86400000),
        amount: invoice.total,
        outstanding: invoice.total,
               status: 'OPEN',
             },
           });
           await tx.serviceInvoice.update({
             where: { id: invoiceId },
             data: { status: 'POSTED', postedAt: new Date(), journalEntryId: entry.id, financeDocumentId: financeDocument.id },
          });
          await tx.auditEvent.create({
            data: { actorId, action: 'POST', entityType: 'ServiceInvoice', entityId: invoice.id, metadata: { journalEntryId: entry.id } },
          });
        }
      } else {
        await tx.serviceInvoice.update({
          where: { id: invoiceId },
          data: { status: 'POSTED', postedAt: new Date() },
        });
      }

      return tx.serviceInvoice.findUnique({
        where: { id: invoiceId },
        include: { jobCard: { include: { customer: true, vehicle: true } }, financeDocument: { include: { receivable: true } } },
      });
    });
  }
}
