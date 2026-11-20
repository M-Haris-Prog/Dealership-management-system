import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ReportingService, ReportFilter } from './reporting.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('reporting/kpis')
  @RequirePermissions('reporting.dashboard.read')
  kpis(@Query() q: ReportFilter) {
    return this.service.kpis(q);
  }

  @Get('reporting/summary')
  @RequirePermissions('reporting.report.read')
  summary(@Query() q: ReportFilter) {
    return this.service.summary(q);
  }

  @Get('reporting/profitability')
  @RequirePermissions('reporting.report.read')
  profitability(@Query() q: ReportFilter) {
    return this.service.profitability(q);
  }

  @Get('reporting/drilldown/:source')
  @RequirePermissions('reporting.report.read')
  drill(@Param('source') source: string, @Query() q: ReportFilter) {
    return this.service.drilldown(source, q);
  }

  @Get('reporting/metadata')
  @RequirePermissions('reporting.report.read')
  metadata() {
    return this.service.metadata();
  }

  @Post('reporting/export/:source')
  @RequirePermissions('reporting.export')
  export(@Param('source') source: string, @Body() q: ReportFilter) {
    return this.service.exportData(source, q);
  }

  @Get('admin/users')
  @RequirePermissions('users.manage')
  users(@Query() q: ReportFilter) {
    return this.service.users(q);
  }

  @Post('admin/users')
  @RequirePermissions('users.manage')
  createUser(
    @Body()
    body: {
      username: string;
      email: string;
      password?: string;
      roleIds?: string[];
      isActive?: boolean;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createUser(body, req.user.id);
  }

  @Post('admin/users/:id/access')
  @RequirePermissions('users.manage')
  updateAccess(
    @Param('id') id: string,
    @Body() body: { isActive?: boolean; roleIds?: string[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateUserAccess(id, body, req.user.id);
  }

  @Get('admin/roles')
  @RequirePermissions('users.manage')
  roles() {
    return this.service.roles();
  }

  @Get('admin/permissions')
  @RequirePermissions('users.manage')
  permissions() {
    return this.service.permissions();
  }

  @Get('admin/departments')
  @RequirePermissions('users.manage')
  departments() {
    return this.service.departments();
  }

  @Post('admin/departments')
  @RequirePermissions('users.manage')
  createDepartment(@Body() body: { code: string; name: string }, @Req() req: AuthenticatedRequest) {
    return this.service.createDepartment(body, req.user.id);
  }

  @Get('admin/audit')
  @RequirePermissions('audit.view')
  audits(@Query() q: ReportFilter) {
    return this.service.audits(q);
  }

  @Get('admin/approval-rules')
  @RequirePermissions('approvals.inbox.read')
  approvalRules() {
    return this.service.approvalRules();
  }

  @Get('admin/approvals')
  @RequirePermissions('approvals.inbox.read')
  approvals(@Query() q: ReportFilter) {
    return this.service.approvals(q);
  }

  @Post('admin/approvals/:kind/:id/decision')
  @RequirePermissions('approvals.decide')
  decide(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: { decision: string; notes?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.decide(kind, id, body.decision, req.user.id, body.notes);
  }
}
