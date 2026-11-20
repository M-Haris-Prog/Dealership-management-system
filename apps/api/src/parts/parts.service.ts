import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePartDto,
  CreatePartCategoryDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  StockAdjustmentCommandDto,
  StockCommandDto,
  StockTransferCommandDto,
} from './dto/parts.dto';

@Injectable()
export class PartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  listParts() {
    return this.prisma.part.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { name: 'asc' } });
  }

  listCategories() {
    return this.prisma.partCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createCategory(dto: CreatePartCategoryDto, actorId: string) {
    const code = dto.code.trim().toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.partCategory.create({ data: { code, name: dto.name.trim() } });
      await tx.auditEvent.create({ data: { actorId, action: 'CREATE', entityType: 'PartCategory', entityId: category.id, metadata: { code } } });
      return category;
    });
  }

  async lowStockAlerts(locationId?: string) {
    const balances = await this.stockSummary(locationId);
    return balances.filter((item: any) => item.isLowStock).map((item: any) => ({
      ...item,
      suggestedOrderQuantity: item.part?.maxStockLevel ? Math.max(Number(item.part.maxStockLevel) - Number(item.quantity), 0) : undefined,
    }));
  }

  async createPart(dto: CreatePartDto, actorId: string) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.part.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException(`Part code "${code}" already exists in the catalog.`);
    }
    return this.prisma.$transaction(async (tx) => {
      const category = dto.categoryCode && tx.partCategory?.findUnique
        ? await tx.partCategory.findUnique({ where: { code: dto.categoryCode.trim().toUpperCase() } })
        : null;
      if (dto.categoryCode && !category) throw new NotFoundException('Part category not found');
      const part = await tx.part.create({
        data: {
          code,
          name: dto.name.trim(),
           description: dto.description?.trim() || null,
           categoryId: category?.id,
           unit: dto.unit?.trim().toUpperCase() || 'EA',
           reorderLevel: dto.reorderLevel ?? 0,
           maxStockLevel: dto.maxStockLevel ?? 0,
        },
      });
      await tx.auditEvent.create({
        data: { actorId, action: 'CREATE', entityType: 'Part', entityId: part.id, metadata: { code: part.code } },
      });
      return part;
    });
  }

  async createPartsBatch(dtos: CreatePartDto[], actorId: string) {
    if (!Array.isArray(dtos) || dtos.length === 0) {
      throw new BadRequestException('At least one part is required.');
    }
    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const dto of dtos) {
        const code = dto.code.trim().toUpperCase();
        const existing = await tx.part.findUnique({ where: { code } });
        if (existing) {
          throw new BadRequestException(`Part code "${code}" already exists in the catalog.`);
        }
         const category = dto.categoryCode && tx.partCategory?.findUnique
           ? await tx.partCategory.findUnique({ where: { code: dto.categoryCode.trim().toUpperCase() } })
           : null;
         if (dto.categoryCode && !category) throw new NotFoundException('Part category not found');
         const part = await tx.part.create({
          data: {
            code,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            categoryId: category?.id,
            unit: dto.unit?.trim().toUpperCase() || 'EA',
            reorderLevel: dto.reorderLevel ?? 0,
            maxStockLevel: dto.maxStockLevel ?? 0,
          },
        });
        await tx.auditEvent.create({
          data: { actorId, action: 'CREATE', entityType: 'Part', entityId: part.id, metadata: { code: part.code } },
        });
        created.push(part);
      }
      return created;
    });
  }

  listSuppliers() {
    return this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  createSupplier(dto: CreateSupplierDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({ data: dto });
      await tx.auditEvent.create({
        data: { actorId, action: 'CREATE', entityType: 'Supplier', entityId: supplier.id, metadata: { code: supplier.code } },
      });
      return supplier;
    });
  }

  async stockSummary(locationId?: string) {
    let resolvedLocationId: string | undefined;
    if (locationId) {
      resolvedLocationId = await this.resolveLocationId(locationId);
    }

    const [balances, allParts, defaultLocation] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: resolvedLocationId ? { locationId: resolvedLocationId } : undefined,
        include: { location: { select: { id: true, code: true, name: true } } },
        orderBy: [{ locationId: 'asc' }, { itemCode: 'asc' }],
      }),
      this.prisma.part.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, unit: true, reorderLevel: true },
      }),
      this.prisma.location.findFirst({
        where: resolvedLocationId ? { id: resolvedLocationId } : { code: 'MAIN' },
        select: { id: true, code: true, name: true },
      }),
    ]);

    const byCode = new Map(allParts.map((part) => [part.code, part]));
    const resultBalances = balances.map((balance) => {
      const part = byCode.get(balance.itemCode) ?? null;
      const reorderLevel = part ? Number(part.reorderLevel) : 0;
      const quantity = Number(balance.quantity);
      return {
        ...balance,
        quantity,
        part,
        isLowStock: quantity <= reorderLevel,
        status: quantity <= reorderLevel ? (quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK') : 'HEALTHY',
      };
    });

    // Also include active parts that have zero recorded balance in this location
    const coveredCodes = new Set(resultBalances.map((b) => b.itemCode));
    for (const part of allParts) {
      if (!coveredCodes.has(part.code)) {
        const reorderLevel = Number(part.reorderLevel);
        resultBalances.push({
          id: `virtual-${part.code}`,
          locationId: defaultLocation?.id || 'MAIN',
          itemCode: part.code,
          quantity: 0,
          updatedAt: new Date(),
          location: defaultLocation || { id: 'MAIN', code: 'MAIN', name: 'Main Parts Store' },
          part,
          isLowStock: reorderLevel >= 0,
          status: 'OUT_OF_STOCK',
        } as any);
      }
    }

    return resultBalances;
  }

  async receive(dto: StockCommandDto, actorId: string) {
    const itemCode = dto.itemCode.trim().toUpperCase();
    const part = await this.ensurePart(itemCode);
    const locationId = await this.resolveLocationId(dto.locationId);
    const result = await this.inventory.receive({ ...dto, itemCode, locationId }, actorId);
    const receiptNo = `GR-${randomUUID().slice(0, 8).toUpperCase()}`;
    await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNo,
          locationId,
          receivedById: actorId,
          lines: { create: { partId: part.id, quantity: dto.quantity } },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'RECEIVE',
          entityType: 'GoodsReceipt',
          entityId: receipt.id,
           metadata: { receiptNo, itemCode, quantity: dto.quantity },
        },
      });
    });
    return result;
  }

  async issue(dto: StockCommandDto, actorId: string) {
    const itemCode = dto.itemCode.trim().toUpperCase();
    const part = await this.ensurePart(itemCode);
    const locationId = await this.resolveLocationId(dto.locationId);
    const result = await this.inventory.issue({ ...dto, itemCode, locationId }, actorId);
    const issueNo = `PI-${randomUUID().slice(0, 8).toUpperCase()}`;
    await this.prisma.$transaction(async (tx) => {
      const issue = await tx.partsIssue.create({
        data: {
          issueNo,
          locationId,
          issuedById: actorId,
          jobCardId: dto.jobCardId,
          requestId: dto.requestId,
          totalCost: new Prisma.Decimal(result.totalCost || 0).abs(),
          lines: { create: { partId: part.id, quantity: dto.quantity } },
        },
      });
      if (dto.requestId && tx.partsRequestLine?.findFirst) {
        const requestLine = await tx.partsRequestLine.findFirst({ where: { requestId: dto.requestId, partId: part.id } });
        if (requestLine) {
          const issued = new Prisma.Decimal(requestLine.issuedQuantity).plus(dto.quantity);
          if (issued.gt(requestLine.quantity)) throw new BadRequestException('Issued quantity exceeds parts request');
          await tx.partsRequestLine.update({ where: { id: requestLine.id }, data: { issuedQuantity: issued, status: issued.equals(requestLine.quantity) ? 'ISSUED' : 'REQUESTED' } });
        }
      }
      let journalEntryId: string | undefined;
      const issueCost = new Prisma.Decimal(result.totalCost || 0).abs();
      if (issueCost.gt(0) && tx.chartOfAccount?.findUnique && tx.journalEntry?.create) {
        const [cogs, inventoryAccount, period] = await Promise.all([
          tx.chartOfAccount.findUnique({ where: { code: '5000' } }),
          tx.chartOfAccount.findUnique({ where: { code: '1200' } }),
          tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } }),
        ]);
        if (cogs && inventoryAccount && period) {
          const journal = await tx.journalEntry.create({ data: { fiscalPeriodId: period.id, entryDate: new Date(), description: `Parts issue ${issueNo}`, sourceType: 'PARTS_ISSUE', sourceId: issue.id, status: 'POSTED', postedAt: new Date(), createdById: actorId, lines: { create: [{ accountId: cogs.id, debit: issueCost, credit: 0, description: `Cost of parts issued ${itemCode}` }, { accountId: inventoryAccount.id, debit: 0, credit: issueCost, description: `Inventory relief ${itemCode}` }] } } });
          journalEntryId = journal.id;
          if (tx.partsIssue?.update) await tx.partsIssue.update({ where: { id: issue.id }, data: { journalEntryId } });
        }
      }
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'ISSUE',
          entityType: 'PartsIssue',
          entityId: issue.id,
           metadata: { issueNo, itemCode: dto.itemCode, quantity: dto.quantity, jobCardId: dto.jobCardId, requestId: dto.requestId, totalCost: issueCost, journalEntryId },
        },
      });
    });
    return result;
  }

  async return(dto: StockCommandDto, actorId: string) {
    const itemCode = dto.itemCode.trim().toUpperCase();
    const part = await this.ensurePart(itemCode);
    const locationId = await this.resolveLocationId(dto.locationId);
    const result = await this.inventory.return({ ...dto, itemCode, locationId }, actorId);
    const returnNo = `PR-${randomUUID().slice(0, 8).toUpperCase()}`;
    await this.prisma.$transaction(async (tx) => {
      const returned = await tx.partsReturn.create({
        data: {
          returnNo,
          locationId,
          returnedById: actorId,
          lines: { create: { partId: part.id, quantity: dto.quantity } },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'RETURN',
          entityType: 'PartsReturn',
          entityId: returned.id,
          metadata: { returnNo, itemCode: dto.itemCode, quantity: dto.quantity },
        },
      });
    });
    return result;
  }

  async transfer(dto: StockTransferCommandDto, actorId: string) {
    const itemCode = dto.itemCode.trim().toUpperCase();
    await this.ensurePart(itemCode);
    return this.inventory.transfer(
      {
        fromLocationId: dto.fromLocationId,
        toLocationId: dto.toLocationId,
         itemCode,
        quantity: dto.quantity,
        reference: dto.reference,
      },
      actorId,
    );
  }

  async adjust(dto: StockAdjustmentCommandDto, actorId: string) {
    const itemCode = dto.itemCode.trim().toUpperCase();
    await this.ensurePart(itemCode);
    return this.inventory.adjust(
      {
        locationId: dto.locationId,
         itemCode,
        newQuantity: dto.newQuantity,
        reason: dto.reason,
      },
      actorId,
    );
  }

  listMovements(locationId?: string, limit?: number) {
    return this.inventory.listTransactions({ locationId, limit });
  }

  async listPurchaseOrders() {
    return this.prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            part: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
        receipts: { select: { id: true, receiptNo: true, receivedAt: true } },
      },
      orderBy: { orderedAt: 'desc' },
    });
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, actorId: string) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('At least one order line is required');
    }
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const orderNo = `PO-${Date.now().toString(36).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      // Resolve all parts
      const lineData = [];
      for (const line of dto.lines) {
        const part = await tx.part.findUnique({ where: { code: line.partCode.trim().toUpperCase() } });
        if (!part) throw new NotFoundException(`Part "${line.partCode}" not found`);
        lineData.push({
          partId: part.id,
          quantity: new Prisma.Decimal(line.quantity),
          unitCost: new Prisma.Decimal(line.unitCost),
        });
      }

      const po = await tx.purchaseOrder.create({
        data: {
          orderNo,
          supplierId: dto.supplierId,
          status: 'SENT',
          notes: dto.notes,
          lines: { create: lineData },
        },
        include: {
          supplier: true,
          lines: { include: { part: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'CREATE',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          metadata: { orderNo, supplierId: dto.supplierId, lineCount: dto.lines.length },
        },
      });

      return po;
    });
  }

  async receivePurchaseOrder(poId: string, locationIdOrCode: string, actorId: string) {
    const locationId = await this.resolveLocationId(locationIdOrCode);

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        supplier: true,
        lines: { include: { part: true } },
      },
    });

    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status === 'RECEIVED') throw new BadRequestException('Purchase order has already been received');

    const receiptNo = `GR-${Date.now().toString(36).toUpperCase()}`;

    // Receive stock, goods receipt, payable, and accounting in one transaction.
    let totalCost = new Prisma.Decimal(0);
    const openLines = po.lines.map((line) => ({ ...line, remaining: line.quantity.minus(line.receivedQuantity ?? new Prisma.Decimal(0)) })).filter((line) => line.remaining.gt(0));
    if (openLines.length === 0) throw new BadRequestException('Purchase order has no remaining quantity to receive');
    return this.prisma.$transaction(async (tx) => {
      for (const line of openLines) {
        const lineTotal = line.remaining.times(line.unitCost || 0);
        totalCost = totalCost.plus(lineTotal);
        const receiveCommand = {
          locationId,
          itemCode: line.part.code,
          quantity: Number(line.remaining),
          unitCost: Number(line.unitCost || 0),
          reference: `Receipt against ${po.orderNo}`,
        };
        if (this.inventory.receiveInTransaction) {
          await this.inventory.receiveInTransaction(tx, receiveCommand, actorId);
        } else {
          await this.inventory.receive(receiveCommand, actorId);
        }
      }

      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNo,
          purchaseOrderId: po.id,
          locationId,
          receivedById: actorId,
          lines: {
            create: openLines.map((l) => ({
              partId: l.partId,
              quantity: l.remaining,
              unitCost: l.unitCost,
            })),
          },
        },
      });

       const isFullyReceived = po.lines.every((existing) => {
         const incoming = openLines.find((line) => line.id === existing.id)?.remaining ?? new Prisma.Decimal(0);
         return (existing.receivedQuantity ?? new Prisma.Decimal(0)).plus(incoming).gte(existing.quantity);
       });
       await tx.purchaseOrder.update({
         where: { id: po.id },
          data: { status: isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
        });

       if (tx.purchaseOrderLine?.update) {
         for (const line of openLines) {
           await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: { increment: line.remaining } } });
         }
       }

      // Parts-to-Accounts integration: Create FinanceDocument & Payable
      const financeDocNo = `DOC-${Date.now().toString(36).toUpperCase()}`;
      const financeDoc = await tx.financeDocument.create({
        data: {
          documentNo: financeDocNo,
          type: 'PAYABLE',
          sourceType: 'PURCHASE_ORDER',
          sourceId: po.id,
          amount: totalCost,
          createdById: actorId,
        },
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const payable = await tx.payable.create({
        data: {
          documentId: financeDoc.id,
          supplierId: po.supplierId,
          dueDate,
          amount: totalCost,
          outstanding: totalCost,
          status: 'OPEN',
        },
      });

      // Parts-to-Accounts Posting: Balanced double-entry journal (1200 Inventory vs 2000 AP)
      let journalEntryId: string | undefined;
      const [invAcc, apAcc, openPeriod] = await Promise.all([
        tx.chartOfAccount.findUnique({ where: { code: '1200' } }),
        tx.chartOfAccount.findUnique({ where: { code: '2000' } }),
        tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } }),
      ]);

      if (invAcc && apAcc && openPeriod && totalCost.greaterThan(0)) {
        const journal = await tx.journalEntry.create({
          data: {
            fiscalPeriodId: openPeriod.id,
            entryDate: new Date(),
            description: `Inventory Receipt ${receiptNo} for ${po.orderNo} (${po.supplier.name})`,
            sourceType: 'GOODS_RECEIPT',
            sourceId: receipt.id,
            status: 'POSTED',
            postedAt: new Date(),
            createdById: actorId,
            lines: {
              create: [
                { accountId: invAcc.id, debit: totalCost, credit: 0, description: `Inventory receipt for PO ${po.orderNo}` },
                { accountId: apAcc.id, debit: 0, credit: totalCost, description: `Accounts payable to ${po.supplier.name}` },
              ],
            },
          },
        });
        journalEntryId = journal.id;
        if (tx.financeDocument?.update) {
          await tx.financeDocument.update({
            where: { id: financeDoc.id },
            data: { journalEntryId },
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'RECEIVE_PO',
          entityType: 'GoodsReceipt',
          entityId: receipt.id,
          metadata: {
            purchaseOrderId: po.id,
            receiptNo,
            totalCost: Number(totalCost),
            payableId: payable.id,
            journalEntryId,
          },
        },
      });

      return {
        success: true,
        receiptNo,
        totalCost: Number(totalCost),
        payableId: payable.id,
        journalEntryId,
      };
    });
  }

  private async resolveLocationId(locationIdOrCode: string): Promise<string> {
    const location = await this.prisma.location.findFirst({
      where: { OR: [{ id: locationIdOrCode }, { code: locationIdOrCode }] },
      select: { id: true },
    });
    if (!location) throw new NotFoundException(`Location "${locationIdOrCode}" not found`);
    return location.id;
  }

  private async ensurePart(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const part = await this.prisma.part.findUnique({ where: { code: normalizedCode } });
    if (!part || !part.isActive) throw new NotFoundException('Part not found or inactive');
    if (!code.trim()) throw new BadRequestException('itemCode is required');
    return part;
  }
}
