import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDocumentDto, CreateBookingDto, CreateBookingRequestDto, CreateCustomerDto, CreateLeadActivityDto, CreateLeadDto, CreatePaymentScheduleDto, CreateSalesDeliveryDto, CreateSalesInvoiceDto, CreateSalesPaymentDto, DecideBookingRequestDto, CreateVehicleDto } from './dto/sales.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveBranchId(branchId?: string, tx?: Prisma.TransactionClient) {
    if (branchId) return branchId;
    const client = tx ?? this.prisma;
    const branch = await client.branch.findFirst();
    if (!branch) throw new NotFoundException('No active branch found');
    return branch.id;
  }

  async listCustomers(branchId?: string) {
    const activeBranchId = branchId || (await this.prisma.branch.findFirst())?.id;
    return this.prisma.customer.findMany({
      where: activeBranchId ? { branchId: activeBranchId } : {},
      select: { id: true, branchId: true, ownerId: true, name: true, phone: true, email: true, address: true, sourceType: true, sourceId: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listVehicles(branchId?: string) {
    const activeBranchId = branchId || (await this.prisma.branch.findFirst())?.id;
    const vehicles = await this.prisma.vehicle.findMany({
      where: activeBranchId ? { branchId: activeBranchId } : {},
      include: {
        customer: { select: { id: true, name: true, phone: true, sourceId: true } },
        bookings: {
          select: { id: true, bookingNo: true, status: true, bookingDate: true },
          orderBy: { bookingDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return vehicles.map((v) => {
      const latestBooking = v.bookings[0];
      let status = v.availability || 'AVAILABLE';
      if (latestBooking) {
        if (latestBooking.status === 'COMPLETED' || latestBooking.status === 'DELIVERED') status = 'SOLD';
        else if (latestBooking.status === 'CONFIRMED' || latestBooking.status === 'RESERVED' || latestBooking.status === 'INVOICED') status = 'RESERVED';
      }
      return {
        ...v,
        status,
        customerName: v.customer?.name,
        customerCode: v.customer?.sourceId,
      };
    });
  }

  async listLeads(branchId?: string) {
    const activeBranchId = branchId || (await this.prisma.branch.findFirst())?.id;
    const leads = await this.prisma.lead.findMany({
      where: activeBranchId ? { branchId: activeBranchId } : {},
      include: {
        customer: { select: { id: true, name: true, phone: true, sourceId: true } },
        owner: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return leads.map((l) => ({
      ...l,
      ownerName: l.owner?.username,
      customerName: l.customer?.name,
      customerCode: l.customer?.sourceId,
    }));
  }

  async listBookings(branchId?: string) {
    const activeBranchId = branchId || (await this.prisma.branch.findFirst())?.id;
    const bookings = await this.prisma.booking.findMany({
      where: activeBranchId ? { branchId: activeBranchId } : {},
      include: {
        customer: { select: { id: true, name: true, phone: true, sourceId: true } },
        vehicle: { select: { id: true, registrationNo: true, make: true, model: true, modelYear: true, color: true, sourceType: true, sourceId: true } },
        lead: { select: { id: true, name: true, phone: true } },
        owner: { select: { id: true, username: true } },
      },
      orderBy: { bookingDate: 'desc' },
    });
    return bookings.map((b) => {
      const customerName = b.customer?.name || (b.notes?.startsWith('Customer: ') ? b.notes.replace('Customer: ', '') : undefined);
      const vehicleName = b.vehicle
        ? [b.vehicle.modelYear, b.vehicle.make, b.vehicle.model].filter(Boolean).join(' ') + (b.vehicle.registrationNo ? ` (${b.vehicle.registrationNo})` : '')
        : undefined;
      return {
        ...b,
        customerName,
        customerCode: b.customer?.sourceId,
        vehicleName,
        ownerName: b.owner?.username,
      };
    });
  }

  async updateBookingStatus(id: string, status: string, notes?: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking with ID ${id} not found`);

      const allowed: Record<string, string[]> = {
        RESERVED: ['RESERVED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
        CONFIRMED: ['CONFIRMED', 'INVOICED', 'CANCELLED'],
        INVOICED: ['INVOICED', 'DELIVERED', 'CANCELLED'],
        DELIVERED: ['DELIVERED', 'COMPLETED'],
        COMPLETED: ['COMPLETED'],
        CANCELLED: ['CANCELLED'],
      };
      if (!allowed[booking.status]?.includes(status)) {
        throw new BadRequestException(`Invalid booking transition from ${booking.status} to ${status}`);
      }

      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: status as any,
          notes: notes ? (booking.notes ? `${booking.notes} | ${notes}` : notes) : booking.notes,
        },
        include: {
          customer: { select: { id: true, name: true, sourceId: true } },
          vehicle: { select: { id: true, registrationNo: true, make: true, model: true } },
        },
      });

      if (actorId && tx.bookingStatusHistory?.create) {
        await tx.bookingStatusHistory.create({
          data: { bookingId: id, fromStatus: booking.status, toStatus: status as any, note: notes, changedById: actorId },
        });
      }
      if (status === 'CANCELLED' && booking.vehicleId) {
        await tx.vehicle.update({ where: { id: booking.vehicleId }, data: { availability: 'AVAILABLE' } });
      }
      if (status === 'DELIVERED' || status === 'COMPLETED') {
        if (booking.vehicleId) await tx.vehicle.update({ where: { id: booking.vehicleId }, data: { availability: 'SOLD' } });
      }

      if (actorId) {
        await tx.auditEvent.create({
          data: {
            actorId,
            action: 'UPDATE',
            entityType: 'Booking',
            entityId: id,
            metadata: { previousStatus: booking.status, newStatus: status, notes },
          },
        });
      }

      return updated;
    });
  }

  private async generateUniqueCustomerId(tx: Prisma.TransactionClient): Promise<string> {
    const total = await tx.customer.count();
    let num = total + 1;
    let code = `CUST-${String(num).padStart(4, '0')}`;
    while (await tx.customer.findFirst({ where: { sourceId: code } })) {
      num += 1;
      code = `CUST-${String(num).padStart(4, '0')}`;
    }
    return code;
  }

  private async nextBookingNumber(tx: Prisma.TransactionClient) {
    const sequence = await tx.numberSequence.findUnique({ where: { key: 'SALES_BOOKING' } });
    if (!sequence) {
      await tx.numberSequence.create({ data: { key: 'SALES_BOOKING', prefix: 'BK-', nextValue: 2, padding: 5 } });
      return 'BK-00001';
    }
    await tx.numberSequence.update({ where: { id: sequence.id }, data: { nextValue: { increment: 1 } } });
    return `${sequence.prefix}${String(sequence.nextValue).padStart(sequence.padding, '0')}`;
  }

  async createCustomer(branchId: string | undefined, dto: CreateCustomerDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const activeBranchId = await this.resolveBranchId(branchId, tx);
      let customerCode = dto.sourceId?.trim().toUpperCase();
      if (!customerCode) {
        customerCode = await this.generateUniqueCustomerId(tx);
      } else {
        const existing = await tx.customer.findFirst({ where: { sourceId: customerCode } });
        if (existing) {
          customerCode = await this.generateUniqueCustomerId(tx);
        }
      }
      const customer = await tx.customer.create({
        data: {
          branchId: activeBranchId,
          ownerId: actorId,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          cnicHash: dto.cnic ? createHash('sha256').update(dto.cnic).digest('hex') : undefined,
          sourceType: dto.sourceType || 'CUSTOMER_CODE',
          sourceId: customerCode,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Customer',
          entityId: customer.id,
          metadata: { branchId: activeBranchId, sourceType: dto.sourceType, sourceId: dto.sourceId },
        },
      });
      return tx.customer.findUnique({
        where: { id: customer.id },
        select: { id: true, branchId: true, ownerId: true, name: true, phone: true, email: true, address: true, sourceType: true, sourceId: true, createdAt: true, updatedAt: true },
      });
    });
  }

  async createVehicle(branchId: string | undefined, dto: CreateVehicleDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const activeBranchId = await this.resolveBranchId(branchId, tx);
      if (dto.customerId && !(await tx.customer.findFirst({ where: { id: dto.customerId, branchId: activeBranchId }, select: { id: true } }))) {
        throw new NotFoundException('Customer not found in branch');
      }
      const sourceType = dto.sourceType ?? (dto.price !== undefined ? 'SALE_PRICE' : undefined);
      const sourceId = dto.sourceId ?? (dto.price !== undefined ? String(dto.price) : undefined);
      const vehicle = await tx.vehicle.create({
        data: {
          branchId: activeBranchId,
          ownerId: actorId,
          customerId: dto.customerId,
          registrationNo: dto.registrationNo,
          vin: dto.vin,
          make: dto.make,
          model: dto.model,
          modelYear: dto.modelYear,
          color: dto.color,
          salePrice: dto.salePrice ?? dto.price,
          availability: 'AVAILABLE',
          sourceType,
          sourceId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Vehicle',
          entityId: vehicle.id,
          metadata: { branchId: activeBranchId, sourceType, sourceId },
        },
      });
      return vehicle;
    });
  }

  async createLead(branchId: string | undefined, dto: CreateLeadDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const activeBranchId = await this.resolveBranchId(branchId, tx);
      if (dto.customerId && !(await tx.customer.findFirst({ where: { id: dto.customerId, branchId: activeBranchId }, select: { id: true } }))) {
        throw new NotFoundException('Customer not found in branch');
      }
      const lead = await tx.lead.create({
        data: {
          branchId: activeBranchId,
          ownerId: dto.ownerId || actorId,
          customerId: dto.customerId,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          interest: dto.interest,
          status: dto.status as any,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Lead',
          entityId: lead.id,
          metadata: { branchId: activeBranchId, sourceType: dto.sourceType, sourceId: dto.sourceId },
        },
      });
      return lead;
    });
  }

  async createBooking(branchId: string | undefined, dto: CreateBookingDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const activeBranchId = await this.resolveBranchId(branchId, tx);
      const bookingNo = dto.bookingNo ?? await this.nextBookingNumber(tx);
      const existingBookings = await tx.booking.findMany({ where: { branchId: activeBranchId, bookingNo }, select: { id: true } });
      if (existingBookings.length > 0) throw new BadRequestException(`Booking number "${bookingNo}" already exists`);
      const related = await Promise.all([
        dto.customerId ? tx.customer.findFirst({ where: { id: dto.customerId, branchId: activeBranchId }, select: { id: true } }) : null,
        dto.vehicleId ? tx.vehicle.findFirst({ where: { id: dto.vehicleId, branchId: activeBranchId }, select: { id: true } }) : null,
        dto.leadId ? tx.lead.findFirst({ where: { id: dto.leadId, branchId: activeBranchId }, select: { id: true } }) : null,
      ]);
      if ((dto.customerId && !related[0]) || (dto.vehicleId && !related[1]) || (dto.leadId && !related[2])) {
        throw new NotFoundException('Booking reference not found in branch');
      }
      if (!dto.customerId) throw new BadRequestException('A booking must be linked to a customer');
      if (dto.vehicleId) {
        const activeReservation = tx.booking.findFirst ? await tx.booking.findFirst({ where: { vehicleId: dto.vehicleId, status: { in: ['RESERVED', 'CONFIRMED', 'INVOICED'] } } }) : null;
        if (activeReservation) throw new BadRequestException('Vehicle is already reserved or allocated to another booking');
      }
      const vehicle = dto.vehicleId && tx.vehicle.findUnique ? await tx.vehicle.findUnique({ where: { id: dto.vehicleId }, select: { salePrice: true } }) : null;
      const totalAmount = new Prisma.Decimal(dto.totalAmount ?? vehicle?.salePrice ?? 0);
      const discountAmount = new Prisma.Decimal(dto.discountAmount ?? 0);
      if (discountAmount.gt(totalAmount)) throw new BadRequestException('Discount cannot exceed booking amount');
      const approvalRequired = totalAmount.gt(0) || discountAmount.gt(0);
      const booking = await tx.booking.create({
        data: {
          branchId: activeBranchId,
          ownerId: actorId,
          customerId: dto.customerId,
          vehicleId: dto.vehicleId,
          leadId: dto.leadId,
          bookingNo,
          bookingDate: new Date(dto.bookingDate),
          status: (dto.status || 'RESERVED') as any,
          totalAmount: totalAmount.minus(discountAmount),
          discountAmount,
          approvalStatus: approvalRequired ? 'PENDING' : 'NOT_REQUIRED',
          allocationStatus: dto.vehicleId ? 'ALLOCATED' : 'UNALLOCATED',
          notes: dto.notes,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: { branchId: activeBranchId, sourceType: dto.sourceType, sourceId: dto.sourceId },
        },
      });
      if (tx.bookingStatusHistory?.create) await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, toStatus: booking.status, note: 'Booking created', changedById: actorId } });
      if (dto.vehicleId && tx.vehicle.update) await tx.vehicle.update({ where: { id: dto.vehicleId }, data: { availability: 'RESERVED' } });
      if (approvalRequired) {
        if (tx.bookingRequest?.create) await tx.bookingRequest.create({ data: { bookingId: booking.id, type: 'BOOKING_APPROVAL', reason: 'Booking requires Sales Manager approval before confirmation.', amount: totalAmount.minus(discountAmount), requesterId: actorId } });
      }
      return booking;
    });
  }

  async getBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        lead: true,
        owner: { select: { id: true, username: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        paymentSchedules: { orderBy: { installmentNo: 'asc' } },
        invoices: { orderBy: { issuedAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        deliveries: { orderBy: { createdAt: 'desc' } },
        requests: { orderBy: { createdAt: 'desc' }, include: { requester: { select: { id: true, username: true } }, approver: { select: { id: true, username: true } } } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async listLeadActivities(leadId: string) {
    return this.prisma.salesLeadActivity.findMany({ where: { leadId }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }] });
  }

  async createLeadActivity(leadId: string, dto: CreateLeadActivityDto, actorId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.salesLeadActivity.create({ data: { leadId, type: dto.type as any, subject: dto.subject, notes: dto.notes, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined, createdById: actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'SalesLeadActivity', entityId: activity.id, metadata: { leadId, type: dto.type } } });
      return activity;
    });
  }

  async completeLeadActivity(id: string, actorId: string) {
    const activity = await this.prisma.salesLeadActivity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Lead activity not found');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.salesLeadActivity.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await tx.auditEvent.create({ data: { actorId, action: 'COMPLETE', entityType: 'SalesLeadActivity', entityId: id } });
      return result;
    });
  }

  async listPaymentSchedules(bookingId: string) {
    return this.prisma.paymentSchedule.findMany({ where: { bookingId }, orderBy: { installmentNo: 'asc' }, include: { payments: true } });
  }

  async createPaymentSchedule(bookingId: string, dto: CreatePaymentScheduleDto, actorId: string) {
    if (!dto.lines?.length) throw new BadRequestException('At least one payment installment is required');
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new NotFoundException('Booking not found');
      const total = dto.lines.reduce((sum, line) => sum + Number(line.amount), 0);
      if (total > Number(booking.totalAmount) + 0.01) throw new BadRequestException('Payment schedule cannot exceed booking total');
      await tx.paymentSchedule.deleteMany({ where: { bookingId, status: 'OPEN' } });
      const rows = [];
      for (const line of dto.lines) {
        rows.push(await tx.paymentSchedule.create({ data: { bookingId, installmentNo: line.installmentNo, dueDate: new Date(line.dueDate), amount: new Prisma.Decimal(line.amount), notes: line.notes } }));
      }
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'PaymentSchedule', entityId: bookingId, metadata: { total, installments: rows.length } } });
      return rows;
    });
  }

  async createBookingDocument(bookingId: string, dto: CreateBookingDocumentDto, actorId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.bookingDocument.create({ data: { bookingId, documentType: dto.documentType, attachmentId: dto.attachmentId, referenceNo: dto.referenceNo, notes: dto.notes, createdById: actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'BookingDocument', entityId: document.id, metadata: { bookingId, documentType: dto.documentType, attachmentId: dto.attachmentId } } });
      return document;
    });
  }

  async listBookingRequests(bookingId?: string, status?: string) {
    return this.prisma.bookingRequest.findMany({ where: { bookingId, status: status ? status as any : undefined }, include: { requester: { select: { id: true, username: true } }, approver: { select: { id: true, username: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async createBookingRequest(bookingId: string, dto: CreateBookingRequestDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new NotFoundException('Booking not found');
      const existing = await tx.bookingRequest.findFirst({ where: { bookingId, type: dto.type as any, status: 'PENDING' } });
      if (existing) throw new BadRequestException('A request of this type is already pending');
      const request = await tx.bookingRequest.create({ data: { bookingId, type: dto.type as any, reason: dto.reason, amount: dto.amount === undefined ? undefined : new Prisma.Decimal(dto.amount), metadata: dto.vehicleId ? { vehicleId: dto.vehicleId } : undefined, requesterId: actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'BookingRequest', entityId: request.id, metadata: { bookingId, type: dto.type, amount: dto.amount } } });
      return request;
    });
  }

  async decideBookingRequest(id: string, dto: DecideBookingRequestDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.bookingRequest.findUnique({ where: { id }, include: { booking: true } });
      if (!request || request.status !== 'PENDING') throw new NotFoundException('Pending booking request not found');
      if (request.requesterId === actorId) throw new BadRequestException('The requester cannot decide their own booking request');
      const approved = dto.decision === 'APPROVED';
      const result = await tx.bookingRequest.update({ where: { id }, data: { status: approved ? 'APPROVED' : 'REJECTED', approverId: actorId, decidedAt: new Date() } });
      if (!approved && request.type === 'BOOKING_APPROVAL') {
        await tx.booking.update({ where: { id: request.bookingId }, data: { approvalStatus: 'REJECTED' } });
      }
      if (approved) {
        if (request.type === 'BOOKING_APPROVAL') {
          await tx.booking.update({ where: { id: request.bookingId }, data: { approvalStatus: 'APPROVED', status: 'CONFIRMED' } });
          await tx.bookingStatusHistory.create({ data: { bookingId: request.bookingId, fromStatus: request.booking.status, toStatus: 'CONFIRMED', note: 'Booking approval granted', changedById: actorId } });
        } else if (request.type === 'CANCELLATION') {
          await tx.booking.update({ where: { id: request.bookingId }, data: { status: 'CANCELLED', allocationStatus: 'RELEASED' } });
          if (request.booking.vehicleId) await tx.vehicle.update({ where: { id: request.booking.vehicleId }, data: { availability: 'AVAILABLE' } });
          await tx.bookingStatusHistory.create({ data: { bookingId: request.bookingId, fromStatus: request.booking.status, toStatus: 'CANCELLED', note: request.reason, changedById: actorId } });
        } else if (request.type === 'DISCOUNT' || request.type === 'DEDUCTION') {
          const amount = request.amount ?? new Prisma.Decimal(0);
          const nextTotal = new Prisma.Decimal(request.booking.totalAmount).minus(amount);
          if (nextTotal.isNegative()) throw new BadRequestException('Approved adjustment exceeds booking total');
          await tx.booking.update({ where: { id: request.bookingId }, data: { totalAmount: nextTotal, discountAmount: new Prisma.Decimal(request.booking.discountAmount).plus(amount) } });
        } else if (request.type === 'ALLOCATION_CHANGE') {
          const vehicleId = (request.metadata as { vehicleId?: string } | null)?.vehicleId;
          if (!vehicleId) throw new BadRequestException('Allocation change request must include a vehicle');
          const active = await tx.booking.findFirst({ where: { vehicleId, status: { in: ['RESERVED', 'CONFIRMED', 'INVOICED'] }, id: { not: request.bookingId } } });
          if (active) throw new BadRequestException('Requested vehicle is already reserved');
          if (request.booking.vehicleId) await tx.vehicle.update({ where: { id: request.booking.vehicleId }, data: { availability: 'AVAILABLE' } });
          await tx.booking.update({ where: { id: request.bookingId }, data: { vehicleId, allocationStatus: 'ALLOCATED' } });
          await tx.vehicle.update({ where: { id: vehicleId }, data: { availability: 'RESERVED' } });
        } else if (request.type === 'REFUND') {
          const amount = request.amount ?? new Prisma.Decimal(0);
          if (amount.lte(0)) throw new BadRequestException('Refund amount must be positive');
          const received = await tx.salesPayment.aggregate({ where: { bookingId: request.bookingId, type: 'RECEIPT', status: { in: ['RECORDED', 'ALLOCATED'] } }, _sum: { amount: true } });
          if (amount.gt(received._sum.amount ?? new Prisma.Decimal(0))) throw new BadRequestException('Refund cannot exceed recorded sales receipts');
          const [cash, ar, period] = await Promise.all([
            tx.chartOfAccount.findFirst({ where: { code: '1000', isActive: true } }),
            tx.chartOfAccount.findFirst({ where: { code: '1100', isActive: true } }),
            tx.fiscalPeriod.findFirst({ where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } } }),
          ]);
          if (!cash || !ar || !period) throw new BadRequestException('Refund posting requires cash, AR, and an open fiscal period');
          const payment = await tx.salesPayment.create({ data: { bookingId: request.bookingId, paymentNo: `PAY-SALES-${randomUUID().slice(0, 8).toUpperCase()}`, type: 'REFUND', status: 'REFUNDED', amount, paymentMethod: 'CASH', reference: `Approved request ${id}`, createdById: actorId } });
          const journal = await tx.journalEntry.create({ data: { fiscalPeriodId: period.id, entryDate: new Date(), description: `Refund for booking ${request.booking.bookingNo}`, sourceType: 'VEHICLE_SALE_REFUND', sourceId: payment.id, status: 'POSTED', postedAt: new Date(), createdById: actorId, lines: { create: [{ accountId: ar.id, debit: amount, credit: 0 }, { accountId: cash.id, debit: 0, credit: amount }] } } });
          await tx.salesPayment.update({ where: { id: payment.id }, data: { journalEntryId: journal.id } });
        }
      }
      await tx.auditEvent.create({ data: { actorId, action: dto.decision, entityType: 'BookingRequest', entityId: id, metadata: { type: request.type, bookingId: request.bookingId, notes: dto.notes } } });
      return result;
    });
  }

  async createSalesInvoice(bookingId: string, dto: CreateSalesInvoiceDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true, customer: true } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status === 'CANCELLED' || booking.approvalStatus === 'PENDING' || !booking.customerId) throw new BadRequestException('Booking must be approved, active, and customer-linked before invoicing');
      const existing = await tx.salesInvoice.findFirst({ where: { bookingId, status: { in: ['DRAFT', 'POSTED', 'PAID'] } } });
      if (existing) return existing;
      const subtotal = new Prisma.Decimal(booking.totalAmount);
      const tax = new Prisma.Decimal(dto.tax ?? 0);
      const invoice = await tx.salesInvoice.create({ data: { bookingId, invoiceNo: `INV-SALES-${randomUUID().slice(0, 8).toUpperCase()}`, subtotal, tax, total: subtotal.plus(tax), createdById: actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'SalesInvoice', entityId: invoice.id, metadata: { bookingId, total: invoice.total.toString() } } });
      return invoice;
    });
  }

  async postSalesInvoice(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findUnique({ where: { id }, include: { booking: true } });
      if (!invoice) throw new NotFoundException('Sales invoice not found');
      if (invoice.status !== 'DRAFT') throw new BadRequestException('Only draft sales invoices can be posted');
      const [ar, revenue, period] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { code: '1100', isActive: true } }),
        tx.chartOfAccount.findFirst({ where: { code: '4000', isActive: true } }),
        tx.fiscalPeriod.findFirst({ where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } } }),
      ]);
      if (!ar || !revenue || !period) throw new BadRequestException('Sales posting requires AR, vehicle revenue, and an open fiscal period');
      const document = await tx.financeDocument.create({ data: { documentNo: invoice.invoiceNo, type: 'RECEIVABLE', sourceType: 'VEHICLE_SALE_INVOICE', sourceId: invoice.id, amount: invoice.total, createdById: actorId } });
      const receivable = await tx.receivable.create({ data: { documentId: document.id, customerId: invoice.booking.customerId, dueDate: new Date(Date.now() + 30 * 86400000), amount: invoice.total, outstanding: invoice.total, status: 'OPEN' } });
      const journal = await tx.journalEntry.create({ data: { fiscalPeriodId: period.id, entryDate: new Date(), description: `Vehicle sale invoice ${invoice.invoiceNo}`, sourceType: 'VEHICLE_SALE_INVOICE', sourceId: invoice.id, status: 'POSTED', postedAt: new Date(), createdById: actorId, lines: { create: [{ accountId: ar.id, debit: invoice.total, credit: 0, description: `AR ${invoice.invoiceNo}` }, { accountId: revenue.id, debit: 0, credit: invoice.total, description: `Vehicle revenue ${invoice.invoiceNo}` }] } } });
      const updated = await tx.salesInvoice.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date(), financeDocumentId: document.id, journalEntryId: journal.id } });
      await tx.booking.update({ where: { id: invoice.bookingId }, data: { status: 'INVOICED' } });
      await tx.bookingStatusHistory.create({ data: { bookingId: invoice.bookingId, fromStatus: invoice.booking.status, toStatus: 'INVOICED', note: `Invoice ${invoice.invoiceNo} posted`, changedById: actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'POST', entityType: 'SalesInvoice', entityId: id, metadata: { financeDocumentId: document.id, receivableId: receivable.id, journalEntryId: journal.id } } });
      return updated;
    });
  }

  async listSalesInvoices(bookingId?: string) {
    return this.prisma.salesInvoice.findMany({ where: bookingId ? { bookingId } : undefined, include: { booking: { include: { customer: true, vehicle: true } } }, orderBy: { issuedAt: 'desc' } });
  }

  async createSalesPayment(bookingId: string, dto: CreateSalesPaymentDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { paymentSchedules: true, invoices: { where: { status: { in: ['POSTED', 'PAID'] } } } } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status === 'CANCELLED') throw new BadRequestException('Cannot record payment for a cancelled booking');
      const amount = new Prisma.Decimal(dto.amount);
      const [cash, ar, period] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { code: '1000', isActive: true } }),
        tx.chartOfAccount.findFirst({ where: { code: '1100', isActive: true } }),
        tx.fiscalPeriod.findFirst({ where: { status: 'OPEN', startsOn: { lte: new Date() }, endsOn: { gte: new Date() } } }),
      ]);
      if (!cash || !ar || !period) throw new BadRequestException('Sales payment posting requires cash, AR, and an open fiscal period');
      const payment = await tx.salesPayment.create({ data: { bookingId, scheduleId: dto.scheduleId, paymentNo: `PAY-SALES-${randomUUID().slice(0, 8).toUpperCase()}`, type: (dto.type || 'RECEIPT') as any, amount, paymentMethod: dto.paymentMethod || 'CASH', reference: dto.reference, createdById: actorId } });
      const isRefund = dto.type === 'REFUND';
      const journal = await tx.journalEntry.create({ data: { fiscalPeriodId: period.id, entryDate: new Date(), description: `${isRefund ? 'Refund' : 'Receipt'} for booking ${booking.bookingNo}`, sourceType: 'VEHICLE_SALE_PAYMENT', sourceId: payment.id, status: 'POSTED', postedAt: new Date(), createdById: actorId, lines: { create: isRefund ? [{ accountId: ar.id, debit: amount, credit: 0 }, { accountId: cash.id, debit: 0, credit: amount }] : [{ accountId: cash.id, debit: amount, credit: 0 }, { accountId: ar.id, debit: 0, credit: amount }] } } });
      await tx.salesPayment.update({ where: { id: payment.id }, data: { journalEntryId: journal.id, status: isRefund ? 'REFUNDED' : 'ALLOCATED' } });
      if (dto.scheduleId && !isRefund) {
        const schedule = await tx.paymentSchedule.findUnique({ where: { id: dto.scheduleId } });
        if (!schedule || schedule.bookingId !== bookingId) throw new BadRequestException('Payment schedule does not belong to booking');
        const paid = new Prisma.Decimal(schedule.paidAmount).plus(amount);
        if (paid.gt(schedule.amount)) throw new BadRequestException('Payment exceeds installment amount');
        await tx.paymentSchedule.update({ where: { id: schedule.id }, data: { paidAmount: paid, status: paid.equals(schedule.amount) ? 'PAID' : 'PARTIALLY_PAID' } });
      }
      await tx.auditEvent.create({ data: { actorId, action: isRefund ? 'REFUND' : 'CREATE', entityType: 'SalesPayment', entityId: payment.id, metadata: { bookingId, journalEntryId: journal.id, amount: dto.amount } } });
      return tx.salesPayment.findUnique({ where: { id: payment.id } });
    });
  }

  async listSalesPayments(bookingId: string) {
    return this.prisma.salesPayment.findMany({ where: { bookingId }, orderBy: { createdAt: 'desc' }, include: { schedule: true } });
  }

  async deliverBooking(bookingId: string, dto: CreateSalesDeliveryDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { invoices: { where: { status: { in: ['POSTED', 'PAID'] } } } } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status === 'CANCELLED') throw new BadRequestException('Cancelled booking cannot be delivered');
      if (Number(booking.totalAmount) > 0 && booking.invoices.length === 0) throw new BadRequestException('A posted vehicle invoice is required before delivery');
      const delivery = await tx.salesDelivery.create({ data: { bookingId, deliveryNo: `DEL-SALES-${randomUUID().slice(0, 8).toUpperCase()}`, status: 'DELIVERED', deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : new Date(), deliveredTo: dto.deliveredTo, notes: dto.notes, createdById: actorId } });
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'DELIVERED' } });
      if (booking.vehicleId) await tx.vehicle.update({ where: { id: booking.vehicleId }, data: { availability: 'SOLD' } });
      await tx.bookingStatusHistory.create({ data: { bookingId, fromStatus: booking.status, toStatus: 'DELIVERED', note: dto.notes, changedById: actorId } });
      await tx.auditEvent.create({ data: { actorId, action: 'DELIVER', entityType: 'SalesDelivery', entityId: delivery.id, metadata: { bookingId } } });
      return delivery;
    });
  }

  async salesReports(filters?: { from?: string; to?: string; ownerId?: string }) {
    const createdAt = filters?.from || filters?.to ? { gte: filters.from ? new Date(filters.from) : undefined, lte: filters.to ? new Date(filters.to) : undefined } : undefined;
    const bookingDate = createdAt ? { bookingDate: createdAt } : {};
    const owner = filters?.ownerId ? { ownerId: filters.ownerId } : {};
    const [leads, wonLeads, bookings, cancellations, deliveries, invoices, payments, byOwner] = await Promise.all([
      this.prisma.lead.count({ where: { ...owner, ...(createdAt ? { createdAt } : {}) } }),
      this.prisma.lead.count({ where: { ...owner, status: 'WON', ...(createdAt ? { createdAt } : {}) } }),
      this.prisma.booking.count({ where: { ...owner, ...bookingDate } }),
      this.prisma.booking.count({ where: { ...owner, status: 'CANCELLED', ...bookingDate } }),
      this.prisma.salesDelivery.count({ where: { status: 'DELIVERED', ...(createdAt ? { createdAt } : {}) } }),
      this.prisma.salesInvoice.aggregate({ where: { status: { in: ['POSTED', 'PAID'] }, ...(createdAt ? { issuedAt: createdAt } : {}) }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.salesPayment.aggregate({ where: { type: 'RECEIPT', ...(createdAt ? { createdAt } : {}) }, _sum: { amount: true } }),
      this.prisma.user.findMany({ where: { bookings: { some: { ...bookingDate } } }, select: { id: true, username: true, _count: { select: { bookings: true, leads: true } } } }),
    ]);
    return { filters, leads, wonLeads, conversionRate: leads ? Number(((wonLeads / leads) * 100).toFixed(2)) : 0, bookings, cancellations, deliveries, invoices: invoices._count._all, invoicedAmount: Number(invoices._sum.total || 0), receivedAmount: Number(payments._sum.amount || 0), bySalesperson: byOwner };
  }
}
