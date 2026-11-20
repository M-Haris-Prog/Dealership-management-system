import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import {
  ApprovalDto,
  CreateRepairOrderDto,
  DamageAssessmentDto,
  InsuranceCaseDto,
  MaterialDto,
  MovementDto,
  OperationDto,
  StatusDto,
  UpdateOperationDto,
  FinalInspectionDto,
} from './dto/body-paint.dto';
import { BodyPaintService } from './body-paint.service';

@Controller('body-paint')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BodyPaintController {
  constructor(private readonly service: BodyPaintService) {}

  @Get('repair-orders')
  @RequirePermissions('bodypaint.repair-order.read')
  list(
    @Query('branchId') branchId?: string,
    @Query('customerId') customerId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({ branchId, customerId, vehicleId, status });
  }

  @Get('repair-orders/:id')
  @RequirePermissions('bodypaint.repair-order.read')
  getOne(@Param('id') id: string) {
    return this.service.getRepairOrder(id);
  }

  @Get('history/vehicle/:vehicleId')
  @RequirePermissions('bodypaint.repair-order.read')
  vehicleHistory(@Param('vehicleId') vehicleId: string) {
    return this.service.getVehicleRepairHistory(vehicleId);
  }

  @Get('history/customer/:customerId')
  @RequirePermissions('bodypaint.repair-order.read')
  customerHistory(@Param('customerId') customerId: string) {
    return this.service.getCustomerRepairHistory(customerId);
  }

  @Post('repair-orders')
  @RequirePermissions('bodypaint.repair-order.create')
  create(@Body() dto: CreateRepairOrderDto, @Req() r: AuthenticatedRequest) {
    return this.service.create(dto, r.user.id);
  }

  @Post('repair-orders/:id/insurance-case')
  @RequirePermissions('bodypaint.insurance.manage')
  insurance(@Param('id') id: string, @Body() dto: InsuranceCaseDto, @Req() r: AuthenticatedRequest) {
    return this.service.insurance(id, dto, r.user.id);
  }

  @Get('repair-orders/:id/insurance')
  @RequirePermissions('bodypaint.insurance.manage')
  insuranceList(@Param('id') id: string) {
    return this.service.listInsurance(id);
  }

  @Post('repair-orders/:id/insurance')
  @RequirePermissions('bodypaint.insurance.manage')
  insuranceAlias(@Param('id') id: string, @Body() dto: InsuranceCaseDto, @Req() r: AuthenticatedRequest) {
    return this.service.insurance(id, dto, r.user.id);
  }

  @Post('repair-orders/:id/damage-assessment')
  @RequirePermissions('bodypaint.assessment.create')
  assessment(@Param('id') id: string, @Body() dto: DamageAssessmentDto, @Req() r: AuthenticatedRequest) {
    return this.service.assessment(id, dto, r.user.id);
  }

  @Get('repair-orders/:id/damage-assessments')
  @RequirePermissions('bodypaint.assessment.create')
  assessmentList(@Param('id') id: string) {
    return this.service.listAssessments(id);
  }

  @Post('repair-orders/:id/damage-assessments')
  @RequirePermissions('bodypaint.assessment.create')
  assessmentAlias(@Param('id') id: string, @Body() dto: DamageAssessmentDto, @Req() r: AuthenticatedRequest) {
    return this.service.assessment(id, dto, r.user.id);
  }

  @Post('repair-orders/:id/approval')
  @RequirePermissions('bodypaint.approval.manage')
  approval(@Param('id') id: string, @Body() dto: ApprovalDto, @Req() r: AuthenticatedRequest) {
    return this.service.approval(id, dto, r.user.id);
  }

  @Get('repair-orders/:id/approvals')
  @RequirePermissions('bodypaint.approval.manage')
  approvalList(@Param('id') id: string) {
    return this.service.listApprovals(id);
  }

  @Post('repair-orders/:id/approvals')
  @RequirePermissions('bodypaint.approval.manage')
  approvalAlias(@Param('id') id: string, @Body() dto: ApprovalDto, @Req() r: AuthenticatedRequest) {
    return this.service.approval(id, dto, r.user.id);
  }

  @Post('approvals/:id/decision')
  @RequirePermissions('bodypaint.approval.manage')
  approvalDecision(
    @Param('id') id: string,
    @Body('status') status: 'APPROVED' | 'REJECTED',
    @Body('notes') notes: string,
    @Req() r: AuthenticatedRequest
  ) {
    return this.service.decideApproval(id, status, notes, r.user.id);
  }

  @Post('repair-orders/:id/operations')
  @RequirePermissions('bodypaint.operation.manage')
  operation(@Param('id') id: string, @Body() dto: OperationDto, @Req() r: AuthenticatedRequest) {
    return this.service.operation(id, dto, r.user.id);
  }

  @Get('repair-orders/:id/operations')
  @RequirePermissions('bodypaint.operation.manage')
  operationList(@Param('id') id: string) {
    return this.service.listOperations(id);
  }

  @Put('operations/:id')
  @RequirePermissions('bodypaint.operation.manage')
  updateOperation(@Param('id') id: string, @Body() dto: UpdateOperationDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateOperation(id, dto, r.user.id);
  }

  @Patch('operations/:id')
  @RequirePermissions('bodypaint.operation.manage')
  updateOperationPatch(@Param('id') id: string, @Body() dto: UpdateOperationDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateOperation(id, dto, r.user.id);
  }

  @Post('repair-orders/:id/vehicle-movement')
  @RequirePermissions('bodypaint.movement.manage')
  movement(@Param('id') id: string, @Body() dto: MovementDto, @Req() r: AuthenticatedRequest) {
    return this.service.movement(id, dto, r.user.id);
  }

  @Get('repair-orders/:id/movements')
  @RequirePermissions('bodypaint.movement.manage')
  movementList(@Param('id') id: string) {
    return this.service.listMovements(id);
  }

  @Post('repair-orders/:id/movements')
  @RequirePermissions('bodypaint.movement.manage')
  movementAlias(@Param('id') id: string, @Body() dto: MovementDto, @Req() r: AuthenticatedRequest) {
    return this.service.movement(id, dto, r.user.id);
  }

  @Post('repair-orders/:id/material-consumption')
  @RequirePermissions('bodypaint.material.manage')
  material(@Param('id') id: string, @Body() dto: MaterialDto, @Req() r: AuthenticatedRequest) {
    return this.service.material(id, dto, r.user.id);
  }

  @Get('repair-orders/:id/materials')
  @RequirePermissions('bodypaint.material.manage')
  materialList(@Param('id') id: string) {
    return this.service.listMaterials(id);
  }

  @Post('repair-orders/:id/materials')
  @RequirePermissions('bodypaint.material.manage')
  materialAlias(@Param('id') id: string, @Body() dto: MaterialDto, @Req() r: AuthenticatedRequest) {
    return this.service.material(id, dto, r.user.id);
  }

  @Put('repair-orders/:id/status')
  @RequirePermissions('bodypaint.status.update')
  status(@Param('id') id: string, @Body() dto: StatusDto, @Req() r: AuthenticatedRequest) {
    return this.service.status(id, dto.status, r.user.id);
  }

  @Patch('repair-orders/:id/status')
  @RequirePermissions('bodypaint.status.update')
  statusPatch(@Param('id') id: string, @Body() dto: StatusDto, @Req() r: AuthenticatedRequest) {
    return this.service.status(id, dto.status, r.user.id);
  }

  @Get('repair-orders/:id/invoice-ready')
  @RequirePermissions('bodypaint.invoice.read')
  invoice(@Param('id') id: string) {
    return this.service.invoiceReady(id);
  }

  @Post('repair-orders/:id/final-inspection')
  @RequirePermissions('bodypaint.status.update')
  finalInspection(@Param('id') id: string, @Body() dto: FinalInspectionDto, @Req() r: AuthenticatedRequest) {
    return this.service.finalInspection(id, dto, r.user.id);
  }

  @Get('repair-orders/:id/final-inspections')
  @RequirePermissions('bodypaint.repair-order.read')
  finalInspectionList(@Param('id') id: string) {
    return this.service.listFinalInspections(id);
  }

  @Get('invoices')
  @RequirePermissions('bodypaint.invoice.read')
  invoices(@Query('branchId') branchId?: string, @Query('repairOrderId') repairOrderId?: string, @Query('status') status?: string) {
    return this.service.listInvoices({ branchId, repairOrderId, status });
  }

  @Post('repair-orders/:id/invoice')
  @RequirePermissions('bodypaint.invoice.read')
  createInvoice(@Param('id') id: string, @Req() r: AuthenticatedRequest) {
    return this.service.createInvoice(id, r.user.id);
  }

  @Post('invoices/:id/post')
  @RequirePermissions('finance.journal.create')
  postInvoice(@Param('id') id: string, @Req() r: AuthenticatedRequest) {
    return this.service.postInvoice(id, r.user.id);
  }

  @Post('repair-orders/:id/deliver')
  @RequirePermissions('bodypaint.status.update')
  deliver(@Param('id') id: string, @Req() r: AuthenticatedRequest) {
    return this.service.deliver(id, r.user.id);
  }

  @Get('reports/workload')
  @RequirePermissions('bodypaint.repair-order.read')
  workload(@Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.reports({ branchId, from, to });
  }

  @Get('reports/performance')
  @RequirePermissions('bodypaint.repair-order.read')
  performance(@Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.reports({ branchId, from, to });
  }
}
