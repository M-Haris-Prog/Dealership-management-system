import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { BranchQueryDto, CreateBookingDocumentDto, CreateBookingDto, CreateBookingRequestDto, CreateCustomerDto, CreateLeadActivityDto, CreateLeadDto, CreatePaymentScheduleDto, CreateSalesDeliveryDto, CreateSalesInvoiceDto, CreateSalesPaymentDto, DecideBookingRequestDto, CreateVehicleDto, UpdateBookingStatusDto } from './dto/sales.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('customers') @RequirePermissions('sales.customer.read') listCustomers(@Query() q: BranchQueryDto) { return this.sales.listCustomers(q.branchId); }
  @Post('customers') @RequirePermissions('sales.customer.create') createCustomer(@Body() dto: CreateCustomerDto, @Query() q: BranchQueryDto, @Req() r: AuthenticatedRequest) { return this.sales.createCustomer(q.branchId, dto, r.user.id); }
  @Get('vehicles') @RequirePermissions('sales.vehicle.read') listVehicles(@Query() q: BranchQueryDto) { return this.sales.listVehicles(q.branchId); }
  @Post('vehicles') @RequirePermissions('sales.vehicle.create') createVehicle(@Body() dto: CreateVehicleDto, @Query() q: BranchQueryDto, @Req() r: AuthenticatedRequest) { return this.sales.createVehicle(q.branchId, dto, r.user.id); }
  @Get('leads') @RequirePermissions('sales.lead.read') listLeads(@Query() q: BranchQueryDto) { return this.sales.listLeads(q.branchId); }
  @Post('leads') @RequirePermissions('sales.lead.create') createLead(@Body() dto: CreateLeadDto, @Query() q: BranchQueryDto, @Req() r: AuthenticatedRequest) { return this.sales.createLead(q.branchId, dto, r.user.id); }
  @Get('bookings') @RequirePermissions('sales.booking.read') listBookings(@Query() q: BranchQueryDto) { return this.sales.listBookings(q.branchId); }
  @Post('bookings') @RequirePermissions('sales.booking.create') createBooking(@Body() dto: CreateBookingDto, @Query() q: BranchQueryDto, @Req() r: AuthenticatedRequest) { return this.sales.createBooking(q.branchId, dto, r.user.id); }
  @Get('bookings/:id') @RequirePermissions('sales.booking.read') getBooking(@Param('id') id: string) { return this.sales.getBooking(id); }
  @Patch('bookings/:id/status') @RequirePermissions('sales.booking.update') updateBookingStatusPatch(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto, @Req() r: AuthenticatedRequest) { return this.sales.updateBookingStatus(id, dto.status, dto.notes, r.user.id); }
  @Post('bookings/:id/status') @RequirePermissions('sales.booking.update') updateBookingStatusPost(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto, @Req() r: AuthenticatedRequest) { return this.sales.updateBookingStatus(id, dto.status, dto.notes, r.user.id); }
  @Get('leads/:id/activities') @RequirePermissions('sales.lead.activity.read') listLeadActivities(@Param('id') id: string) { return this.sales.listLeadActivities(id); }
  @Post('leads/:id/activities') @RequirePermissions('sales.lead.activity.create') createLeadActivity(@Param('id') id: string, @Body() dto: CreateLeadActivityDto, @Req() r: AuthenticatedRequest) { return this.sales.createLeadActivity(id, dto, r.user.id); }
  @Post('lead-activities/:id/complete') @RequirePermissions('sales.lead.activity.complete') completeLeadActivity(@Param('id') id: string, @Req() r: AuthenticatedRequest) { return this.sales.completeLeadActivity(id, r.user.id); }
  @Get('bookings/:id/payment-schedule') @RequirePermissions('sales.booking.payment.read') listPaymentSchedules(@Param('id') id: string) { return this.sales.listPaymentSchedules(id); }
  @Post('bookings/:id/payment-schedule') @RequirePermissions('sales.booking.create') createPaymentSchedule(@Param('id') id: string, @Body() dto: CreatePaymentScheduleDto, @Req() r: AuthenticatedRequest) { return this.sales.createPaymentSchedule(id, dto, r.user.id); }
  @Get('bookings/:id/documents') @RequirePermissions('sales.booking.document.read') listBookingDocuments(@Param('id') id: string) { return this.sales.getBooking(id).then((booking) => booking.documents); }
  @Post('bookings/:id/documents') @RequirePermissions('sales.booking.document.create') createBookingDocument(@Param('id') id: string, @Body() dto: CreateBookingDocumentDto, @Req() r: AuthenticatedRequest) { return this.sales.createBookingDocument(id, dto, r.user.id); }
  @Get('bookings/:id/requests') @RequirePermissions('sales.booking.read') listBookingRequests(@Param('id') id: string, @Query('status') status?: string) { return this.sales.listBookingRequests(id, status); }
  @Post('bookings/:id/requests') @RequirePermissions('sales.booking.request.create') createBookingRequest(@Param('id') id: string, @Body() dto: CreateBookingRequestDto, @Req() r: AuthenticatedRequest) { return this.sales.createBookingRequest(id, dto, r.user.id); }
  @Post('booking-requests/:id/decision') @RequirePermissions('sales.booking.request.decide') decideBookingRequest(@Param('id') id: string, @Body() dto: DecideBookingRequestDto, @Req() r: AuthenticatedRequest) { return this.sales.decideBookingRequest(id, dto, r.user.id); }
  @Get('invoices') @RequirePermissions('sales.booking.invoice.read') listSalesInvoices(@Query('bookingId') bookingId?: string) { return this.sales.listSalesInvoices(bookingId); }
  @Post('bookings/:id/invoice') @RequirePermissions('sales.booking.invoice.create') createSalesInvoice(@Param('id') id: string, @Body() dto: CreateSalesInvoiceDto, @Req() r: AuthenticatedRequest) { return this.sales.createSalesInvoice(id, dto, r.user.id); }
  @Post('invoices/:id/post') @RequirePermissions('sales.booking.invoice.post') postSalesInvoice(@Param('id') id: string, @Req() r: AuthenticatedRequest) { return this.sales.postSalesInvoice(id, r.user.id); }
  @Get('bookings/:id/payments') @RequirePermissions('sales.booking.payment.read') listSalesPayments(@Param('id') id: string) { return this.sales.listSalesPayments(id); }
  @Post('bookings/:id/payments') @RequirePermissions('sales.booking.payment.create') createSalesPayment(@Param('id') id: string, @Body() dto: CreateSalesPaymentDto, @Req() r: AuthenticatedRequest) { return this.sales.createSalesPayment(id, dto, r.user.id); }
  @Post('bookings/:id/delivery') @RequirePermissions('sales.booking.delivery.create') deliverBooking(@Param('id') id: string, @Body() dto: CreateSalesDeliveryDto, @Req() r: AuthenticatedRequest) { return this.sales.deliverBooking(id, dto, r.user.id); }
  @Get('reports') @RequirePermissions('sales.report.read') salesReports(@Query('from') from?: string, @Query('to') to?: string, @Query('ownerId') ownerId?: string) { return this.sales.salesReports({ from, to, ownerId }); }
}
