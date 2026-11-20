import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoundationService {
  constructor(private readonly prisma: PrismaService) {}

  private storageRoot() {
    return process.env.ATTACHMENTS_ROOT || join(process.cwd(), '.runtime', 'attachments');
  }

  async notifications(userId: string) {
    return this.prisma.notification.findMany({ where: { recipientId: userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async feed(user: { id: string; username: string; roles: string[]; permissions: string[] }, departmentFilter?: string) {
    const filter = departmentFilter ? departmentFilter.toUpperCase() : undefined;
    const isDirectorOrAdmin =
      user.roles?.some((r) => r.toLowerCase().includes('director') || r.toLowerCase().includes('administrator') || r.toLowerCase().includes('admin')) ||
      user.permissions?.includes('users.manage');

    const hasSales = isDirectorOrAdmin || user.permissions?.some((p) => p.startsWith('sales.'));
    const hasService = isDirectorOrAdmin || user.permissions?.some((p) => p.startsWith('service.'));
    const hasBodyPaint = isDirectorOrAdmin || user.permissions?.some((p) => p.startsWith('bodypaint.'));
    const hasParts = isDirectorOrAdmin || user.permissions?.some((p) => p.startsWith('parts.') || p.startsWith('inventory.'));
    const hasCashier = isDirectorOrAdmin || user.permissions?.some((p) => p.startsWith('cashier.'));
    const hasFinance = isDirectorOrAdmin || user.permissions?.some((p) => p.startsWith('finance.'));

    const items: Array<{
      id: string;
      department: 'SALES' | 'SERVICE' | 'BODY_PAINT' | 'PARTS' | 'CASHIER' | 'FINANCE' | 'GENERAL';
      departmentLabel: string;
      category: string;
      title: string;
      message: string;
      referenceNo?: string;
      amount?: number;
      date: string;
      status?: string;
      priority?: 'HIGH' | 'NORMAL' | 'LOW';
      actionWorkspace?: string;
      isRead?: boolean;
      sourceType?: string;
      sourceId?: string;
      customerId?: string;
      isRecorded?: boolean;
      documentNo?: string;
    }> = [];

    // 1. Direct user notifications
    if (!filter || filter === 'GENERAL') {
      const userNotifs = await this.prisma.notification.findMany({
        where: { recipientId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      for (const un of userNotifs) {
        items.push({
          id: `un-${un.id}`,
          department: 'GENERAL',
          departmentLabel: 'Direct Alert',
          category: un.type || 'SYSTEM',
          title: un.title,
          message: un.message,
          date: un.createdAt.toISOString(),
          isRead: Boolean(un.readAt),
          priority: 'HIGH',
        });
      }
    }

    // 2. Sales department notifications (only if user has sales access)
    if (hasSales && (!filter || filter === 'SALES')) {
      const [pendingRequests, bookings] = await Promise.all([
        this.prisma.bookingRequest.findMany({
          where: { status: 'PENDING' },
          include: { booking: { include: { customer: true, vehicle: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.booking.findMany({
          include: { customer: true, vehicle: true },
          orderBy: { bookingDate: 'desc' },
          take: 10,
        }),
      ]);

      for (const req of pendingRequests) {
        items.push({
          id: `br-${req.id}`,
          department: 'SALES',
          departmentLabel: 'Vehicle Sales',
          category: 'BOOKING_REQUEST_PENDING',
          title: 'Booking Request Awaiting Decision',
          message: `Request for booking (${req.booking?.bookingNo || 'New'}) · ${req.booking?.customer?.name || 'Customer'}: ${req.reason || req.type}`,
          referenceNo: req.booking?.bookingNo,
          amount: req.amount ? Number(req.amount) : undefined,
          date: req.createdAt.toISOString(),
          status: req.status,
          priority: 'HIGH',
          actionWorkspace: 'Vehicle Sales',
        });
      }

      for (const bk of bookings) {
        const vehicleName = bk.vehicle
          ? [bk.vehicle.modelYear, bk.vehicle.make, bk.vehicle.model].filter(Boolean).join(' ') || bk.vehicle.registrationNo
          : 'Vehicle';
        items.push({
          id: `sale-bk-${bk.id}`,
          department: 'SALES',
          departmentLabel: 'Vehicle Sales',
          category: 'BOOKING_CONFIRMED',
          title: `Vehicle Booking (${bk.bookingNo})`,
          message: `Booking for ${bk.customer?.name || 'Customer'} · ${vehicleName} is ${bk.status.toLowerCase()}.`,
          referenceNo: bk.bookingNo,
          date: bk.bookingDate.toISOString(),
          status: bk.status,
          priority: 'NORMAL',
          actionWorkspace: 'Vehicle Sales',
        });
      }
    }

    // 3. Workshop / Service department notifications (only if user has service access)
    if (hasService && (!filter || filter === 'SERVICE' || filter === 'WORKSHOP')) {
      const jobCards = await this.prisma.jobCard.findMany({
        include: { customer: true, vehicle: true },
        orderBy: { openedAt: 'desc' },
        take: 15,
      });
      for (const jc of jobCards) {
        const vehicleName = [jc.vehicle.modelYear, jc.vehicle.make, jc.vehicle.model].filter(Boolean).join(' ') || jc.vehicle.registrationNo || 'Vehicle';
        const isReady = jc.status === 'READY_FOR_INVOICE' || jc.status === 'COMPLETED';
        items.push({
          id: `svc-jc-${jc.id}`,
          department: 'SERVICE',
          departmentLabel: 'Workshop / Service',
          category: isReady ? 'SERVICE_READY' : 'SERVICE_ACTIVE',
          title: isReady ? 'Workshop Service Ready For Delivery' : `Job Card ${jc.status.replace(/_/g, ' ')}`,
          message: `Job card (${jc.jobNo}) for ${vehicleName} · ${jc.customer.name} is ${jc.status.toLowerCase().replace(/_/g, ' ')}.`,
          referenceNo: jc.jobNo,
          date: jc.openedAt.toISOString(),
          status: jc.status,
          priority: isReady ? 'HIGH' : 'NORMAL',
          actionWorkspace: 'Workshop / Service',
        });
      }
    }

    // 4. Body & Paint department notifications (only if user has bodypaint access)
    if (hasBodyPaint && (!filter || filter === 'BODY_PAINT' || filter === 'PAINT')) {
      const bpOrders = await this.prisma.bodyPaintRepairOrder.findMany({
        include: { customer: true, vehicle: true, operations: true },
        orderBy: { openedAt: 'desc' },
        take: 15,
      });
      for (const ro of bpOrders) {
        const isPaint = ro.operations.some((op) => op.type === 'PAINT') || /paint/i.test(ro.complaint || '');
        const vehicleName = [ro.vehicle.modelYear, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(' ') || ro.vehicle.registrationNo || 'Vehicle';
        const isReady = ro.status === 'READY_FOR_INVOICE' || ro.status === 'COMPLETED';
        items.push({
          id: `bp-ro-${ro.id}`,
          department: 'BODY_PAINT',
          departmentLabel: 'Body & Paint',
          category: isPaint ? 'PAINT_ACTIVE' : 'BODY_REPAIR_ACTIVE',
          title: isPaint ? 'Paint Refinishing Order' : 'Collision Repair Order',
          message: `${isPaint ? 'Paint job' : 'Repair order'} (${ro.orderNo}) for ${vehicleName} · ${ro.customer.name} is ${ro.status.toLowerCase().replace(/_/g, ' ')}.`,
          referenceNo: ro.orderNo,
          date: ro.openedAt.toISOString(),
          status: ro.status,
          priority: isReady ? 'HIGH' : 'NORMAL',
          actionWorkspace: 'Body & Paint',
        });
      }
    }

    // 5. Spare Parts notifications (only if user has parts/inventory access)
    if (hasParts && (!filter || filter === 'PARTS')) {
      const [lowStockBalances, partsRequests] = await Promise.all([
        this.prisma.stockBalance.findMany({
          where: { quantity: { lte: 10 } },
          include: { location: true },
          take: 10,
        }),
        this.prisma.partsRequest.findMany({
          include: { jobCard: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      const itemCodes = lowStockBalances.map((b) => b.itemCode);
      const partsMap = new Map();
      if (itemCodes.length > 0) {
        const parts = await this.prisma.part.findMany({ where: { code: { in: itemCodes } } });
        for (const p of parts) partsMap.set(p.code, p);
      }

      for (const sb of lowStockBalances) {
        const p = partsMap.get(sb.itemCode);
        items.push({
          id: `stock-${sb.id}`,
          department: 'PARTS',
          departmentLabel: 'Spare Parts',
          category: 'LOW_STOCK',
          title: `Low Stock Warning: ${sb.itemCode}`,
          message: `${p?.name || sb.itemCode} at ${sb.location.name}: only ${Number(sb.quantity)} units remaining.`,
          referenceNo: sb.itemCode,
          amount: Number(sb.quantity),
          date: sb.updatedAt.toISOString(),
          priority: 'HIGH',
          actionWorkspace: 'Spare Parts',
        });
      }

      for (const pr of partsRequests) {
        items.push({
          id: `pr-${pr.id}`,
          department: 'PARTS',
          departmentLabel: 'Spare Parts',
          category: 'PARTS_REQUEST',
          title: `Parts Request (${pr.requestNo})`,
          message: `Requisition for job card (${pr.jobCard?.jobNo || 'General'}) is ${pr.status.toLowerCase()}.`,
          referenceNo: pr.requestNo,
          date: pr.createdAt.toISOString(),
          status: pr.status,
          priority: pr.status === 'OPEN' ? 'HIGH' : 'NORMAL',
          actionWorkspace: 'Spare Parts',
        });
      }
    }

    // 6. Cashier notifications (only if user has cashier access)
    if (hasCashier && (!filter || filter === 'CASHIER')) {
      const sessions = await this.prisma.cashierSession.findMany({
        where: { status: 'OPEN' },
        include: { cashier: true },
        orderBy: { openedAt: 'desc' },
        take: 5,
      });
      for (const cs of sessions) {
        items.push({
          id: `cs-${cs.id}`,
          department: 'CASHIER',
          departmentLabel: 'Cashier',
          category: 'CASHIER_SESSION_OPEN',
          title: 'Active Cashier Till Session',
          message: `Till session opened by ${cs.cashier.username}. Opening float: Rs. ${Number(cs.openingBalance).toLocaleString('en-PK')}.`,
          referenceNo: `TILL-${cs.id.slice(-6).toUpperCase()}`,
          amount: Number(cs.openingBalance),
          date: cs.openedAt.toISOString(),
          status: cs.status,
          priority: 'NORMAL',
          actionWorkspace: 'Cashier',
        });
      }
    }

    // 7. Finance notifications (only if user has finance access)
    if (hasFinance && (!filter || filter === 'FINANCE')) {
      const [expenses, recordedDocs] = await Promise.all([
        this.prisma.expense.findMany({
          where: { status: 'PENDING' },
          include: { document: true },
          orderBy: { expenseDate: 'desc' },
          take: 10,
        }),
        this.prisma.financeDocument.findMany({
          where: {
            sourceType: { in: ['BODY_PAINT_REPAIR_ORDER', 'JOB_CARD', 'VEHICLE_BOOKING'] },
          },
        }),
      ]);

      const recordedSet = new Set(recordedDocs.map((d) => `${d.sourceType}:${d.sourceId}`));

      const [unrecordedBp, unrecordedJc, unrecordedBk] = await Promise.all([
        this.prisma.bodyPaintRepairOrder.findMany({
          where: { status: { in: ['COMPLETED', 'READY_FOR_INVOICE'] } },
          include: { customer: true, vehicle: true, invoiceSummary: true },
          take: 10,
        }),
        this.prisma.jobCard.findMany({
          where: { status: { in: ['COMPLETED', 'READY_FOR_INVOICE'] } },
          include: { customer: true, vehicle: true, invoices: true },
          take: 10,
        }),
        this.prisma.booking.findMany({
          where: { status: { in: ['CONFIRMED', 'DELIVERED'] } },
          include: { customer: true, vehicle: true },
          take: 10,
        }),
      ]);

      for (const bp of unrecordedBp) {
        if (!recordedSet.has(`BODY_PAINT_REPAIR_ORDER:${bp.id}`)) {
          const vehicleName = [bp.vehicle.modelYear, bp.vehicle.make, bp.vehicle.model].filter(Boolean).join(' ') || bp.vehicle.registrationNo || 'Vehicle';
          const amt = bp.invoiceSummary ? Number(bp.invoiceSummary.total) : 650;
          items.push({
            id: `fin-bp-${bp.id}`,
            department: 'FINANCE',
            departmentLabel: 'Accounts & Finance',
            category: 'PAINT_BILLING',
            title: 'Body & Paint Completed - Ready To Bill',
            message: `Repair order (${bp.orderNo}) for ${vehicleName} · ${bp.customer.name} ready to record in receivables.`,
            referenceNo: bp.orderNo,
            amount: amt,
            date: bp.openedAt.toISOString(),
            status: 'PENDING_FINANCE',
            priority: 'HIGH',
            actionWorkspace: 'Accounts & Finance',
            sourceType: 'BODY_PAINT_REPAIR_ORDER',
            sourceId: bp.id,
            customerId: bp.customerId,
            isRecorded: false,
          });
        }
      }

      for (const jc of unrecordedJc) {
        if (!recordedSet.has(`JOB_CARD:${jc.id}`)) {
          const vehicleName = [jc.vehicle.modelYear, jc.vehicle.make, jc.vehicle.model].filter(Boolean).join(' ') || jc.vehicle.registrationNo || 'Vehicle';
          const amt = jc.invoices?.[0] ? Number(jc.invoices[0].total) : 320;
          items.push({
            id: `fin-jc-${jc.id}`,
            department: 'FINANCE',
            departmentLabel: 'Accounts & Finance',
            category: 'SERVICE_BILLING',
            title: 'Workshop Service Completed - Ready To Bill',
            message: `Job card (${jc.jobNo}) for ${vehicleName} · ${jc.customer.name} ready to record in receivables.`,
            referenceNo: jc.jobNo,
            amount: amt,
            date: jc.openedAt.toISOString(),
            status: 'PENDING_FINANCE',
            priority: 'HIGH',
            actionWorkspace: 'Accounts & Finance',
            sourceType: 'JOB_CARD',
            sourceId: jc.id,
            customerId: jc.customerId,
            isRecorded: false,
          });
        }
      }

      for (const bk of unrecordedBk) {
        if (!recordedSet.has(`VEHICLE_BOOKING:${bk.id}`)) {
          const vehicleName = bk.vehicle ? [bk.vehicle.modelYear, bk.vehicle.make, bk.vehicle.model].filter(Boolean).join(' ') || bk.vehicle.registrationNo : 'Vehicle';
          items.push({
            id: `fin-bk-${bk.id}`,
            department: 'FINANCE',
            departmentLabel: 'Accounts & Finance',
            category: 'SALE_BILLING',
            title: 'Vehicle Sale Booking - Ready To Bill',
            message: `Booking (${bk.bookingNo}) for ${vehicleName} · ${bk.customer?.name || 'Customer'} ready to record in receivables.`,
            referenceNo: bk.bookingNo,
            amount: 25000,
            date: bk.bookingDate.toISOString(),
            status: 'PENDING_FINANCE',
            priority: 'HIGH',
            actionWorkspace: 'Accounts & Finance',
            sourceType: 'VEHICLE_BOOKING',
            sourceId: bk.id,
            customerId: bk.customerId || undefined,
            isRecorded: false,
          });
        }
      }

      for (const exp of expenses) {
        items.push({
          id: `exp-${exp.id}`,
          department: 'FINANCE',
          departmentLabel: 'Accounts & Finance',
          category: 'EXPENSE_PENDING',
          title: 'Expense Voucher Pending Approval',
          message: `Expense (${exp.description}) for Rs. ${Number(exp.amount).toLocaleString('en-PK')} requires review.`,
          referenceNo: exp.document?.documentNo || `EXP-${exp.id.slice(-6).toUpperCase()}`,
          amount: Number(exp.amount),
          date: exp.expenseDate.toISOString(),
          status: exp.status,
          priority: 'HIGH',
          actionWorkspace: 'Accounts & Finance',
        });
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }

  async markNotificationRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, recipientId: userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async createNotification(body: { recipientId: string; type: string; title: string; message: string; entityType?: string; entityId?: string }, actorId: string) {
    const result = await this.prisma.notification.create({ data: { ...body } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'Notification', entityId: result.id } });
    return result;
  }

  async registerAttachment(body: { entityType: string; entityId: string; fileName: string; contentType: string; contentBase64: string }, actorId: string) {
    if (!body.contentBase64 || body.contentBase64.length > 15_000_000) throw new BadRequestException('Attachment content is required and must be below the size limit');
    const content = Buffer.from(body.contentBase64, 'base64');
    const storageKey = `${randomUUID()}-${body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const root = this.storageRoot();
    await mkdir(root, { recursive: true });
    await writeFile(join(root, storageKey), content, { flag: 'wx' });
    const attachment = await this.prisma.attachment.create({ data: { entityType: body.entityType, entityId: body.entityId, fileName: body.fileName, contentType: body.contentType, sizeBytes: content.byteLength, checksum: createHash('sha256').update(content).digest('hex'), storageKey, uploadedById: actorId } });
    await this.prisma.auditEvent.create({ data: { actorId, action: 'UPLOAD', entityType: 'Attachment', entityId: attachment.id, metadata: { entityType: body.entityType, entityId: body.entityId } } });
    return attachment;
  }

  async readAttachment(id: string, actorId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const content = await readFile(join(this.storageRoot(), attachment.storageKey));
    await this.prisma.attachmentAccessLog.create({ data: { attachmentId: id, actorId, action: 'READ' } });
    return { ...attachment, contentBase64: content.toString('base64') };
  }

  async requestApproval(body: { workflow: string; entityType: string; entityId: string; reason?: string }, requesterId: string) {
    return this.prisma.approvalRequest.create({ data: { ...body, requesterId } });
  }

  async approvals(status?: string) {
    return this.prisma.approvalRequest.findMany({ where: status ? { status: status as any } : undefined, include: { requester: { select: { id: true, username: true } }, approver: { select: { id: true, username: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async decideApproval(id: string, decision: 'APPROVED' | 'REJECTED', notes: string | undefined, actorId: string) {
    const request = await this.prisma.approvalRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'PENDING') throw new NotFoundException('Approval request not found');
    if (request.requesterId === actorId) throw new BadRequestException('The requester cannot decide their own approval');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.approvalRequest.update({ where: { id }, data: { status: decision, decision: notes, approverId: actorId, decidedAt: new Date() } });
      await tx.auditEvent.create({ data: { actorId, action: decision, entityType: 'ApprovalRequest', entityId: id, metadata: { workflow: request.workflow } } });
      return result;
    });
  }
}
