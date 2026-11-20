import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { StockAdjustmentDto, StockMovementDto, StockTransferDto } from './dto/stock-movement.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('receive')
  @RequirePermissions('inventory.stock.receive')
  receive(@Body() dto: StockMovementDto, @Req() request: AuthenticatedRequest) {
    return this.inventory.receive(dto, request.user.id);
  }

  @Post('issue')
  @RequirePermissions('inventory.stock.issue')
  issue(@Body() dto: StockMovementDto, @Req() request: AuthenticatedRequest) {
    return this.inventory.issue(dto, request.user.id);
  }

  @Post('return')
  @RequirePermissions('inventory.stock.receive')
  return(@Body() dto: StockMovementDto, @Req() request: AuthenticatedRequest) {
    return this.inventory.return(dto, request.user.id);
  }

  @Post('transfer')
  @RequirePermissions('inventory.stock.issue')
  transfer(@Body() dto: StockTransferDto, @Req() request: AuthenticatedRequest) {
    return this.inventory.transfer(dto, request.user.id);
  }

  @Post('adjust')
  @RequirePermissions('inventory.stock.receive')
  adjust(@Body() dto: StockAdjustmentDto, @Req() request: AuthenticatedRequest) {
    return this.inventory.adjust(dto, request.user.id);
  }

  @Get('transactions')
  @RequirePermissions('parts.stock.read')
  transactions(
    @Query('locationId') locationId?: string,
    @Query('itemCode') itemCode?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventory.listTransactions({
      locationId,
      itemCode,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
