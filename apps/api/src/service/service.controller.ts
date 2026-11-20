import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import {
  AssignTechnicianDto,
  CreateEstimateDto,
  CreateJobCardDto,
  InspectionDto,
  RecordLaborDto,
  RequestPartsDto,
  UpdateStatusDto,
  CreateServicePackageDto,
  ServiceCheckEventDto,
} from './dto/service.dto';
import { ServiceService } from './service.service';

@Controller('service')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServiceController {
  constructor(private readonly service: ServiceService) {}

  @Get('job-cards')
  @RequirePermissions('service.jobcard.read')
  list(
    @Query('branchId') branchId?: string,
    @Query('customerId') customerId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listJobCards({ branchId, customerId, vehicleId, status });
  }

  @Get('job-cards/:id')
  @RequirePermissions('service.jobcard.read')
  getOne(@Param('id') id: string) {
    return this.service.getJobCard(id);
  }

  @Get('history/vehicle/:vehicleId')
  @RequirePermissions('service.jobcard.read')
  vehicleHistory(@Param('vehicleId') vehicleId: string) {
    return this.service.getVehicleServiceHistory(vehicleId);
  }

  @Get('history/customer/:customerId')
  @RequirePermissions('service.jobcard.read')
  customerHistory(@Param('customerId') customerId: string) {
    return this.service.getCustomerServiceHistory(customerId);
  }

  @Post('job-cards')
  @RequirePermissions('service.jobcard.create')
  create(@Body() dto: CreateJobCardDto, @Req() r: AuthenticatedRequest) {
    return this.service.createJobCard(dto, r.user.id);
  }

  @Get('packages')
  @RequirePermissions('service.jobcard.read')
  packages() {
    return this.service.listPackages();
  }

  @Post('packages')
  @RequirePermissions('service.jobcard.create')
  createPackage(@Body() dto: CreateServicePackageDto, @Req() r: AuthenticatedRequest) {
    return this.service.createPackage(dto, r.user.id);
  }

  @Post('job-cards/:id/estimates')
  @RequirePermissions('service.estimate.create')
  estimate(@Param('id') id: string, @Body() dto: CreateEstimateDto, @Req() r: AuthenticatedRequest) {
    return this.service.createEstimate(id, dto, r.user.id);
  }

  @Post('estimates/:id/approve')
  @RequirePermissions('service.estimate.approve')
  approve(@Param('id') id: string, @Req() r: AuthenticatedRequest) {
    return this.service.approveEstimate(id, r.user.id);
  }

  @Post('job-cards/:id/technician')
  @RequirePermissions('service.assign')
  assign(@Param('id') id: string, @Body() dto: AssignTechnicianDto, @Req() r: AuthenticatedRequest) {
    return this.service.assignTechnician(id, dto, r.user.id);
  }

  @Post('job-cards/:id/parts')
  @RequirePermissions('service.parts.request')
  parts(@Param('id') id: string, @Body() dto: RequestPartsDto, @Req() r: AuthenticatedRequest) {
    return this.service.requestParts(id, dto, r.user.id);
  }

  @Post('job-cards/:id/labor')
  @RequirePermissions('service.labor.record')
  labor(@Param('id') id: string, @Body() dto: RecordLaborDto, @Req() r: AuthenticatedRequest) {
    return this.service.recordLabor(id, dto, r.user.id);
  }

  @Put('job-cards/:id/status')
  @RequirePermissions('service.status.update')
  status(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateStatus(id, dto.status, r.user.id);
  }

  @Patch('job-cards/:id/status')
  @RequirePermissions('service.status.update')
  statusPatch(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateStatus(id, dto.status, r.user.id);
  }

  @Post('job-cards/:id/inspection')
  @RequirePermissions('service.inspection.record')
  inspection(@Param('id') id: string, @Body() dto: InspectionDto, @Req() r: AuthenticatedRequest) {
    return this.service.recordInspection(id, dto, r.user.id);
  }

  @Get('job-cards/:id/check-events')
  @RequirePermissions('service.jobcard.read')
  checkEvents(@Param('id') id: string) {
    return this.service.listCheckEvents(id);
  }

  @Post('job-cards/:id/check-events')
  @RequirePermissions('service.status.update')
  checkEvent(@Param('id') id: string, @Body() dto: ServiceCheckEventDto, @Req() r: AuthenticatedRequest) {
    return this.service.recordCheckEvent(id, dto, r.user.id);
  }

  @Get('job-cards/:id/invoice-ready')
  @RequirePermissions('service.invoice.read')
  invoice(@Param('id') id: string) {
    return this.service.invoiceReadySummary(id);
  }

  @Get('invoices')
  @RequirePermissions('service.invoice.read')
  listInvoices(
    @Query('branchId') branchId?: string,
    @Query('jobCardId') jobCardId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listInvoices({ branchId, jobCardId, status });
  }

  @Post('invoices/:id/post')
  @RequirePermissions('finance.journal.create')
  postInvoice(@Param('id') id: string, @Req() r: AuthenticatedRequest) {
    return this.service.postServiceInvoice(id, r.user.id);
  }

  @Get('reports/workload')
  @RequirePermissions('service.jobcard.read')
  workload(@Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.serviceReports({ branchId, from, to });
  }

  @Get('reports/performance')
  @RequirePermissions('service.jobcard.read')
  performance(@Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.serviceReports({ branchId, from, to });
  }
}
