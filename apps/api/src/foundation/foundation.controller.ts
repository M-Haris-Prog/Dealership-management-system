import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { FoundationService } from './foundation.service';

@Controller('foundation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FoundationController {
  constructor(private readonly service: FoundationService) {}

  @Get('notifications')
  notifications(@Req() req: AuthenticatedRequest) { return this.service.notifications(req.user.id); }

  @Get('feed')
  feed(@Req() req: AuthenticatedRequest, @Query('department') department?: string) {
    return this.service.feed(req.user, department);
  }

  @Post('notifications/:id/read')
  markNotificationRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.service.markNotificationRead(id, req.user.id); }

  @Post('notifications')
  @RequirePermissions('users.manage')
  createNotification(@Body() body: { recipientId: string; type: string; title: string; message: string; entityType?: string; entityId?: string }, @Req() req: AuthenticatedRequest) { return this.service.createNotification(body, req.user.id); }

  @Post('attachments')
  @RequirePermissions('users.manage')
  registerAttachment(@Body() body: { entityType: string; entityId: string; fileName: string; contentType: string; contentBase64: string }, @Req() req: AuthenticatedRequest) { return this.service.registerAttachment(body, req.user.id); }

  @Get('attachments/:id')
  @RequirePermissions('users.manage')
  readAttachment(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.service.readAttachment(id, req.user.id); }

  @Post('approval-requests')
  requestApproval(@Body() body: { workflow: string; entityType: string; entityId: string; reason?: string }, @Req() req: AuthenticatedRequest) { return this.service.requestApproval(body, req.user.id); }

  @Get('approval-requests')
  @RequirePermissions('approvals.inbox.read')
  approvals() { return this.service.approvals(); }

  @Post('approval-requests/:id/decision')
  @RequirePermissions('approvals.decide')
  decideApproval(@Param('id') id: string, @Body() body: { decision: 'APPROVED' | 'REJECTED'; notes?: string }, @Req() req: AuthenticatedRequest) { return this.service.decideApproval(id, body.decision, body.notes, req.user.id); }
}
