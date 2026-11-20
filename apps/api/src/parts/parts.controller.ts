import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import {
  CreatePartDto,
  CreatePartCategoryDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  ReceivePurchaseOrderDto,
  StockAdjustmentCommandDto,
  StockCommandDto,
  StockTransferCommandDto,
} from './dto/parts.dto';
import { PartsService } from './parts.service';

@Controller('parts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PartsController {
  constructor(private readonly parts: PartsService) {}

  @Get()
  @RequirePermissions('parts.read')
  listParts() {
    return this.parts.listParts();
  }

  @Get('categories')
  @RequirePermissions('parts.read')
  listCategories() {
    return this.parts.listCategories();
  }

  @Post('categories')
  @RequirePermissions('parts.manage')
  createCategory(@Body() dto: CreatePartCategoryDto, @Req() r: AuthenticatedRequest) {
    return this.parts.createCategory(dto, r.user.id);
  }

  @Post()
  @RequirePermissions('parts.manage')
  createPart(@Body() dto: CreatePartDto, @Req() r: AuthenticatedRequest) {
    return this.parts.createPart(dto, r.user.id);
  }

  @Post('batch')
  @RequirePermissions('parts.manage')
  createPartsBatch(@Body() dtos: CreatePartDto[], @Req() r: AuthenticatedRequest) {
    return this.parts.createPartsBatch(dtos, r.user.id);
  }

  @Get('suppliers')
  @RequirePermissions('parts.supplier.read')
  listSuppliers() {
    return this.parts.listSuppliers();
  }

  @Post('suppliers')
  @RequirePermissions('parts.supplier.manage')
  createSupplier(@Body() dto: CreateSupplierDto, @Req() r: AuthenticatedRequest) {
    return this.parts.createSupplier(dto, r.user.id);
  }

  @Get('stock')
  @RequirePermissions('parts.stock.read')
  stock(@Query('locationId') locationId?: string) {
    return this.parts.stockSummary(locationId);
  }

  @Get('stock/low-stock')
  @RequirePermissions('parts.stock.read')
  lowStock(@Query('locationId') locationId?: string) {
    return this.parts.lowStockAlerts(locationId);
  }

  @Post('receive')
  @RequirePermissions('parts.stock.receive')
  receive(@Body() dto: StockCommandDto, @Req() r: AuthenticatedRequest) {
    return this.parts.receive(dto, r.user.id);
  }

  @Post('issue')
  @RequirePermissions('parts.stock.issue')
  issue(@Body() dto: StockCommandDto, @Req() r: AuthenticatedRequest) {
    return this.parts.issue(dto, r.user.id);
  }

  @Post('return')
  @RequirePermissions('parts.stock.return')
  return(@Body() dto: StockCommandDto, @Req() r: AuthenticatedRequest) {
    return this.parts.return(dto, r.user.id);
  }

  @Post('transfer')
  @RequirePermissions('parts.stock.issue')
  transfer(@Body() dto: StockTransferCommandDto, @Req() r: AuthenticatedRequest) {
    return this.parts.transfer(dto, r.user.id);
  }

  @Post('adjust')
  @RequirePermissions('parts.stock.receive')
  adjust(@Body() dto: StockAdjustmentCommandDto, @Req() r: AuthenticatedRequest) {
    return this.parts.adjust(dto, r.user.id);
  }

  @Get('movements')
  @RequirePermissions('parts.stock.read')
  listMovements(@Query('locationId') locationId?: string, @Query('limit') limit?: string) {
    return this.parts.listMovements(locationId, limit ? Number(limit) : undefined);
  }

  @Get('purchase-orders')
  @RequirePermissions('parts.read')
  listPurchaseOrders() {
    return this.parts.listPurchaseOrders();
  }

  @Post('purchase-orders')
  @RequirePermissions('parts.manage')
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @Req() r: AuthenticatedRequest) {
    return this.parts.createPurchaseOrder(dto, r.user.id);
  }

  @Post('purchase-orders/:id/receive')
  @RequirePermissions('parts.stock.receive')
  receivePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.parts.receivePurchaseOrder(id, dto.locationId, r.user.id);
  }
}
