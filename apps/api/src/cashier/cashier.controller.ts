import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CashierService } from './cashier.service';
import {
  CashMovementDto,
  CloseSessionDto,
  OpenSessionDto,
  ReceiptDto,
  ReconcileDto,
  ReversalDto,
  VoucherDto,
  QueryReceiptsDto,
  QueryVouchersDto,
  QuerySessionsDto,
  QueryReportsDto,
} from './dto/cashier.dto';

@Controller('cashier')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CashierController {
  constructor(private readonly service: CashierService) {}

  @Post('sessions')
  @RequirePermissions('cashier.session.open')
  open(@Body() d: OpenSessionDto, @Query('branchId') b: string, @Req() r: AuthenticatedRequest) {
    return this.service.openSession(b, d, r.user.id);
  }

  @Post('sessions/:id/close')
  @RequirePermissions('cashier.session.close')
  close(@Param('id') id: string, @Body() d: CloseSessionDto, @Req() r: AuthenticatedRequest) {
    return this.service.closeSession(id, d, r.user.id);
  }

  @Get('reports/discrepancies')
  @RequirePermissions('cashier.session.read')
  discrepancies(@Query() q: QueryReportsDto) {
    return this.service.getDiscrepancyReport(q.branchId, q.from, q.to);
  }

  @Get('reports/summary')
  @RequirePermissions('cashier.session.read')
  summary(@Query() q: QueryReportsDto) {
    return this.service.getCashierSummary(q.branchId, q.from, q.to);
  }

  @Get('sessions')
  @RequirePermissions('cashier.session.read')
  list(@Query() q: QuerySessionsDto, @Req() r: AuthenticatedRequest) {
    const isSupervisor =
      r.user.roles?.some((role) =>
        ['Director / Managing Director', 'Accounts Manager', 'System Administrator'].includes(role),
      ) || r.user.permissions?.includes('approvals.decide');
    const targetCashierId = isSupervisor ? (q.cashierId || undefined) : r.user.id;
    return this.service.listSessions(q.branchId, targetCashierId, q.status);
  }

  @Get('sessions/:id')
  @RequirePermissions('cashier.session.read')
  detail(@Param('id') id: string) {
    return this.service.getSession(id);
  }

  @Post('sessions/:id/cash-in')
  @RequirePermissions('cashier.transaction.create')
  cashIn(@Param('id') id: string, @Body() d: CashMovementDto, @Req() r: AuthenticatedRequest) {
    return this.service.movement(id, d, 'CASH_IN', r.user.id);
  }

  @Post('sessions/:id/cash-out')
  @RequirePermissions('cashier.transaction.create')
  cashOut(@Param('id') id: string, @Body() d: CashMovementDto, @Req() r: AuthenticatedRequest) {
    return this.service.movement(id, d, 'CASH_OUT', r.user.id);
  }

  @Post('sessions/:id/receipts')
  @RequirePermissions('cashier.receipt.create')
  receipt(@Param('id') id: string, @Body() d: ReceiptDto, @Req() r: AuthenticatedRequest) {
    return this.service.receipt(id, d, r.user.id);
  }

  @Get('receipts')
  @RequirePermissions('cashier.session.read')
  listReceipts(@Query() q: QueryReceiptsDto) {
    return this.service.listReceipts(q);
  }

  @Get('receipts/:id')
  @RequirePermissions('cashier.session.read')
  getReceipt(@Param('id') id: string) {
    return this.service.getReceipt(id);
  }

  @Get('receipts/:id/print')
  @RequirePermissions('cashier.session.read')
  printReceipt(@Param('id') id: string) {
    return this.service.getPrintableReceipt(id);
  }

  @Post('sessions/:id/payment-vouchers')
  @RequirePermissions('cashier.voucher.create')
  voucher(@Param('id') id: string, @Body() d: VoucherDto, @Req() r: AuthenticatedRequest) {
    return this.service.voucher(id, d, r.user.id);
  }

  @Get('vouchers')
  @RequirePermissions('cashier.session.read')
  listVouchers(@Query() q: QueryVouchersDto) {
    return this.service.listVouchers(q);
  }

  @Get('vouchers/:id')
  @RequirePermissions('cashier.session.read')
  getVoucher(@Param('id') id: string) {
    return this.service.getVoucher(id);
  }

  @Get('vouchers/:id/print')
  @RequirePermissions('cashier.session.read')
  printVoucher(@Param('id') id: string) {
    return this.service.getPrintableVoucher(id);
  }

  @Post('transactions/:id/reversal')
  @RequirePermissions('cashier.reversal.create')
  reversal(@Param('id') id: string, @Body() d: ReversalDto, @Req() r: AuthenticatedRequest) {
    return this.service.reverse(id, d, r.user.id, r.user.roles, r.user.permissions);
  }

  @Post('sessions/:id/reconciliation')
  @RequirePermissions('cashier.reconcile')
  reconcile(@Param('id') id: string, @Body() d: ReconcileDto, @Req() r: AuthenticatedRequest) {
    return this.service.reconcile(id, d, r.user.id);
  }
}
