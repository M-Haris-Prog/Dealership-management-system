import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StockAdjustmentDto, StockMovementDto, StockTransferDto } from './dto/stock-movement.dto';

interface LockedBalance { id: string; quantity: Prisma.Decimal; averageCost?: Prisma.Decimal; inventoryValue?: Prisma.Decimal }

async function withDeadlockRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isDeadlock =
        err?.code === 'P2034' ||
        err?.message?.includes('Deadlock') ||
        err?.message?.includes('1213') ||
        err?.message?.includes('lock wait timeout');
      if (isDeadlock && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 50));
        continue;
      }
      throw err;
    }
  }
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  receive(dto: StockMovementDto, actorId?: string) {
    return this.move(dto, 'RECEIPT', actorId);
  }

  issue(dto: StockMovementDto, actorId?: string) {
    return this.move(dto, 'ISSUE', actorId);
  }

  return(dto: StockMovementDto, actorId?: string) {
    return this.move(dto, 'RETURN', actorId);
  }

  async receiveInTransaction(tx: Prisma.TransactionClient, dto: StockMovementDto, actorId?: string) {
    const amount = new Prisma.Decimal(dto.quantity);
    const location = await tx.location.findFirst({ where: { OR: [{ id: dto.locationId }, { code: dto.locationId }] }, select: { id: true } });
    if (!location) throw new NotFoundException('Location not found');
    await tx.$executeRaw(Prisma.sql`INSERT IGNORE INTO stock_balances (id, location_id, item_code, quantity, average_cost, inventory_value, updated_at) VALUES (${randomUUID()}, ${location.id}, ${dto.itemCode}, 0, 0, 0, NOW())`);
    const rows = await tx.$queryRaw<LockedBalance[]>(Prisma.sql`SELECT id, quantity, average_cost as averageCost, inventory_value as inventoryValue FROM stock_balances WHERE location_id = ${location.id} AND item_code = ${dto.itemCode} FOR UPDATE`);
    const balance = rows[0];
    if (!balance) throw new BadRequestException('Unable to lock stock balance');
    const currentValue = balance.inventoryValue ?? balance.quantity.times(balance.averageCost ?? new Prisma.Decimal(0));
    const unitCost = dto.unitCost !== undefined ? new Prisma.Decimal(dto.unitCost) : (balance.averageCost ?? new Prisma.Decimal(0));
    const totalCost = amount.times(unitCost);
    const nextQuantity = balance.quantity.plus(amount);
    const nextValue = currentValue.plus(totalCost);
    const nextAverageCost = nextQuantity.gt(0) ? nextValue.div(nextQuantity) : new Prisma.Decimal(0);
    await tx.$executeRaw(Prisma.sql`UPDATE stock_balances SET quantity = ${nextQuantity}, average_cost = ${nextAverageCost}, inventory_value = ${nextValue}, updated_at = NOW() WHERE id = ${balance.id}`);
    const transaction = await tx.stockTransaction.create({ data: { locationId: location.id, itemCode: dto.itemCode, type: 'RECEIPT', quantity: amount, unitCost, totalCost, reference: dto.reference } });
    await tx.auditEvent.create({ data: { actorId, action: 'RECEIVE', entityType: 'StockTransaction', entityId: transaction.id, metadata: { locationId: location.id, itemCode: dto.itemCode, quantity: dto.quantity, totalCost: totalCost.toString() } } });
    return { transaction, quantity: nextQuantity, unitCost, totalCost, inventoryValue: nextValue };
  }

  async transfer(dto: StockTransferDto, actorId?: string) {
    return withDeadlockRetry(async () => {
      const amount = new Prisma.Decimal(dto.quantity);
      return this.prisma.$transaction(async (tx) => {
        const fromLoc = await tx.location.findFirst({
          where: { OR: [{ id: dto.fromLocationId }, { code: dto.fromLocationId }] },
          select: { id: true, code: true },
        });
        if (!fromLoc) throw new NotFoundException('Source location not found');

        const toLoc = await tx.location.findFirst({
          where: { OR: [{ id: dto.toLocationId }, { code: dto.toLocationId }] },
          select: { id: true, code: true },
        });
        if (!toLoc) throw new NotFoundException('Destination location not found');

        if (fromLoc.id === toLoc.id) {
          throw new BadRequestException('Source and destination locations must be different');
        }

        // Lock source balance
        await tx.$executeRaw(Prisma.sql`
          INSERT IGNORE INTO stock_balances (id, location_id, item_code, quantity, updated_at)
          VALUES (${randomUUID()}, ${fromLoc.id}, ${dto.itemCode}, 0, NOW())
        `);
        const fromRows = await tx.$queryRaw<LockedBalance[]>(Prisma.sql`
           SELECT id, quantity, average_cost as averageCost, inventory_value as inventoryValue FROM stock_balances
          WHERE location_id = ${fromLoc.id} AND item_code = ${dto.itemCode}
          FOR UPDATE
        `);
        const fromBalance = fromRows[0];
        if (!fromBalance || fromBalance.quantity.lessThan(amount)) {
          throw new BadRequestException('Insufficient stock for transfer');
        }

        // Lock destination balance
        await tx.$executeRaw(Prisma.sql`
          INSERT IGNORE INTO stock_balances (id, location_id, item_code, quantity, updated_at)
          VALUES (${randomUUID()}, ${toLoc.id}, ${dto.itemCode}, 0, NOW())
        `);
        const toRows = await tx.$queryRaw<LockedBalance[]>(Prisma.sql`
           SELECT id, quantity, average_cost as averageCost, inventory_value as inventoryValue FROM stock_balances
          WHERE location_id = ${toLoc.id} AND item_code = ${dto.itemCode}
          FOR UPDATE
        `);
        const toBalance = toRows[0];

        // Deduct from source and add to destination
         const transferUnitCost = fromBalance.averageCost ?? new Prisma.Decimal(0);
         const transferValue = amount.times(transferUnitCost);
         const fromValue = (fromBalance.inventoryValue ?? fromBalance.quantity.times(transferUnitCost)).minus(transferValue);
         const toValue = (toBalance.inventoryValue ?? toBalance.quantity.times(toBalance.averageCost ?? new Prisma.Decimal(0))).plus(transferValue);
         const fromNext = fromBalance.quantity.minus(amount);
         const toNext = toBalance.quantity.plus(amount);
         const toAverageCost = toNext.gt(0) ? toValue.div(toNext) : new Prisma.Decimal(0);

         await tx.$executeRaw(Prisma.sql`
           UPDATE stock_balances SET quantity = ${fromNext}, inventory_value = ${fromValue}, average_cost = ${fromNext.gt(0) ? fromValue.div(fromNext) : new Prisma.Decimal(0)}, updated_at = NOW() WHERE id = ${fromBalance.id}
        `);
         await tx.$executeRaw(Prisma.sql`
           UPDATE stock_balances SET quantity = ${toNext}, inventory_value = ${toValue}, average_cost = ${toAverageCost}, updated_at = NOW() WHERE id = ${toBalance.id}
        `);

        const ref = dto.reference || `Transfer from ${fromLoc.code} to ${toLoc.code}`;
        const txOut = await tx.stockTransaction.create({
          data: {
            locationId: fromLoc.id,
            itemCode: dto.itemCode,
            type: 'TRANSFER',
             quantity: amount.negated(),
             unitCost: transferUnitCost,
             totalCost: transferValue.negated(),
            reference: ref,
          },
        });
        const txIn = await tx.stockTransaction.create({
          data: {
            locationId: toLoc.id,
            itemCode: dto.itemCode,
            type: 'TRANSFER',
             quantity: amount,
             unitCost: transferUnitCost,
             totalCost: transferValue,
            reference: ref,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId,
            action: 'TRANSFER',
            entityType: 'StockTransaction',
            entityId: txIn.id,
            metadata: {
              fromLocationId: fromLoc.id,
              toLocationId: toLoc.id,
              itemCode: dto.itemCode,
              quantity: dto.quantity,
              reference: ref,
            },
          },
        });

        return { fromQuantity: fromNext, toQuantity: toNext, transactionId: txIn.id };
      });
    });
  }

   async adjust(dto: StockAdjustmentDto, actorId?: string) {
    return withDeadlockRetry(async () => {
      const targetQty = new Prisma.Decimal(dto.newQuantity);
      return this.prisma.$transaction(async (tx) => {
        const location = await tx.location.findFirst({
          where: { OR: [{ id: dto.locationId }, { code: dto.locationId }] },
          select: { id: true, code: true },
        });
        if (!location) throw new NotFoundException('Location not found');

        await tx.$executeRaw(Prisma.sql`
          INSERT IGNORE INTO stock_balances (id, location_id, item_code, quantity, updated_at)
          VALUES (${randomUUID()}, ${location.id}, ${dto.itemCode}, 0, NOW())
        `);
        const rows = await tx.$queryRaw<LockedBalance[]>(Prisma.sql`
           SELECT id, quantity, average_cost as averageCost, inventory_value as inventoryValue FROM stock_balances
          WHERE location_id = ${location.id} AND item_code = ${dto.itemCode}
          FOR UPDATE
        `);
        const balance = rows[0];
        const diff = targetQty.minus(balance.quantity);

         const averageCost = balance.averageCost ?? new Prisma.Decimal(0);
         const inventoryValue = targetQty.times(averageCost);
         await tx.$executeRaw(Prisma.sql`
           UPDATE stock_balances SET quantity = ${targetQty}, inventory_value = ${inventoryValue}, average_cost = ${averageCost}, updated_at = NOW() WHERE id = ${balance.id}
        `);

        const transaction = await tx.stockTransaction.create({
             data: {
            locationId: location.id,
            itemCode: dto.itemCode,
              type: 'ADJUSTMENT',
              quantity: diff,
              unitCost: averageCost,
              totalCost: diff.times(averageCost),
            reference: dto.reason || 'Inventory count adjustment',
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId,
            action: 'ADJUSTMENT',
            entityType: 'StockTransaction',
            entityId: transaction.id,
            metadata: {
              locationId: location.id,
              itemCode: dto.itemCode,
              previousQuantity: balance.quantity,
              newQuantity: targetQty,
              reason: dto.reason,
            },
          },
        });

        return { transaction, quantity: targetQty, difference: diff };
      });
    });
  }

  async listTransactions(query?: { locationId?: string; itemCode?: string; limit?: number }) {
    const take = Math.min(100, Math.max(1, query?.limit || 50));
    let resolvedLocationId: string | undefined;
    if (query?.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { OR: [{ id: query.locationId }, { code: query.locationId }] },
        select: { id: true },
      });
      resolvedLocationId = loc?.id;
    }
    const where: Prisma.StockTransactionWhereInput = {
      ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
      ...(query?.itemCode ? { itemCode: query.itemCode } : {}),
    };
    const txs = await this.prisma.stockTransaction.findMany({
      where,
      include: {
        location: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const parts = await this.prisma.part.findMany({
      where: { code: { in: txs.map((t) => t.itemCode) } },
      select: { code: true, name: true, unit: true },
    });
    const partMap = new Map(parts.map((p) => [p.code, p]));
    return txs.map((t) => ({
      ...t,
      part: partMap.get(t.itemCode) ?? null,
    }));
  }

  private async move(dto: StockMovementDto, type: 'RECEIPT' | 'ISSUE' | 'RETURN', actorId?: string) {
    return withDeadlockRetry(async () => {
      const amount = new Prisma.Decimal(dto.quantity);
      return this.prisma.$transaction(async (tx) => {
        const location = await tx.location.findFirst({
          where: { OR: [{ id: dto.locationId }, { code: dto.locationId }] },
          select: { id: true },
        });
        if (!location) throw new NotFoundException('Location not found');
        const resolvedLocationId = location.id;

        // The insert makes the row lockable even for an item with no previous balance.
        await tx.$executeRaw(Prisma.sql`
          INSERT IGNORE INTO stock_balances (id, location_id, item_code, quantity, updated_at)
          VALUES (${randomUUID()}, ${resolvedLocationId}, ${dto.itemCode}, 0, NOW())
        `);
        const rows = await tx.$queryRaw<LockedBalance[]>(Prisma.sql`
           SELECT id, quantity, average_cost as averageCost, inventory_value as inventoryValue FROM stock_balances
          WHERE location_id = ${resolvedLocationId} AND item_code = ${dto.itemCode}
          FOR UPDATE
        `);
        const balance = rows[0];
        if (!balance) throw new BadRequestException('Unable to lock stock balance');
        if (type === 'ISSUE' && balance.quantity.lessThan(amount)) {
          throw new BadRequestException('Insufficient stock');
        }
         const currentValue = balance.inventoryValue ?? balance.quantity.times(balance.averageCost ?? new Prisma.Decimal(0));
         const existingCost = balance.averageCost ?? new Prisma.Decimal(0);
         const movementUnitCost = dto.unitCost !== undefined ? new Prisma.Decimal(dto.unitCost) : existingCost;
         const movementCost = amount.times(movementUnitCost);
         const nextQuantity = type === 'ISSUE' ? balance.quantity.minus(amount) : balance.quantity.plus(amount);
         const nextValue = type === 'ISSUE' ? currentValue.minus(movementCost) : currentValue.plus(movementCost);
         const nextAverageCost = nextQuantity.gt(0) ? nextValue.div(nextQuantity) : new Prisma.Decimal(0);
         await tx.$executeRaw(Prisma.sql`
           UPDATE stock_balances SET quantity = ${nextQuantity}, inventory_value = ${nextValue}, average_cost = ${nextAverageCost}, updated_at = NOW() WHERE id = ${balance.id}
         `);
         const transaction = await tx.stockTransaction.create({
           data: { locationId: resolvedLocationId, itemCode: dto.itemCode, type, quantity: amount, unitCost: movementUnitCost, totalCost: type === 'ISSUE' ? movementCost.negated() : movementCost, reference: dto.reference },
        });
        await tx.auditEvent.create({
          data: { actorId, action: type, entityType: 'StockTransaction', entityId: transaction.id, metadata: { locationId: resolvedLocationId, itemCode: dto.itemCode, quantity: dto.quantity } },
        });
         return { transaction, quantity: nextQuantity, unitCost: movementUnitCost, totalCost: type === 'ISSUE' ? movementCost.negated() : movementCost, inventoryValue: nextValue };
      });
    });
  }
}
