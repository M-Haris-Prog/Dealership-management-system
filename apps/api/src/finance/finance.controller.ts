import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { FinanceService } from './finance.service';
import { PostJournalEntryDto } from './dto/post-journal-entry.dto';
import {
  ClosePeriodDto,
  CreateAccountDto,
  CreateBankTransactionDto,
  CreateExpenseDto,
  CreatePeriodDto,
  ReconcileDto,
  RecordOperationalJobDto,
  ReopenPeriodDto,
  SettleDocumentDto,
} from './dto/finance-workflow.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('accounts')
  @RequirePermissions('finance.account.read')
  accounts() {
    return this.finance.listAccounts();
  }

  @Post('accounts')
  @RequirePermissions('finance.account.read')
  createAccount(@Body() dto: CreateAccountDto, @Req() req: AuthenticatedRequest) {
    return this.finance.createAccount(dto, req.user.id);
  }

  @Get('fiscal-periods')
  @RequirePermissions('finance.period.read')
  periods() {
    return this.finance.listPeriods();
  }

  @Post('fiscal-periods')
  @RequirePermissions('finance.period.read')
  createPeriod(@Body() dto: CreatePeriodDto, @Req() req: AuthenticatedRequest) {
    return this.finance.createPeriod(dto, req.user.id);
  }

  @Post('fiscal-periods/:id/close')
  @RequirePermissions('finance.period.read')
  closePeriod(@Param('id') id: string, @Body() dto: ClosePeriodDto, @Req() req: AuthenticatedRequest) {
    return this.finance.closePeriod(id, dto, req.user.id);
  }

  @Post('fiscal-periods/:id/reopen')
  @RequirePermissions('finance.period.read')
  reopenPeriod(@Param('id') id: string, @Body() dto: ReopenPeriodDto, @Req() req: AuthenticatedRequest) {
    return this.finance.reopenPeriod(id, dto, req.user.id);
  }

  @Get('receivables')
  @RequirePermissions('finance.receivable.read')
  receivables(@Query('customerId') customerId?: string, @Query('status') status?: string) {
    return this.finance.listReceivables({ customerId, status });
  }

  @Post('receivables/:id/settle')
  @RequirePermissions('finance.journal.create')
  settleReceivable(@Param('id') id: string, @Body() dto: SettleDocumentDto, @Req() req: AuthenticatedRequest) {
    return this.finance.settleReceivable(id, dto, req.user.id);
  }

  @Post('receivables/:id/payment')
  @RequirePermissions('finance.journal.create')
  settleReceivableAlias(@Param('id') id: string, @Body() dto: SettleDocumentDto, @Req() req: AuthenticatedRequest) {
    return this.finance.settleReceivable(id, dto, req.user.id);
  }

  @Get('customers/:customerId/ledger')
  @RequirePermissions('finance.receivable.read')
  customerLedger(@Param('customerId') customerId: string) {
    return this.finance.getCustomerLedger(customerId);
  }

  @Get('payables')
  @RequirePermissions('finance.payable.read')
  payables(@Query('supplierId') supplierId?: string, @Query('status') status?: string) {
    return this.finance.listPayables({ supplierId, status });
  }

  @Post('payables/:id/settle')
  @RequirePermissions('finance.journal.create')
  settlePayable(@Param('id') id: string, @Body() dto: SettleDocumentDto, @Req() req: AuthenticatedRequest) {
    return this.finance.settlePayable(id, dto, req.user.id);
  }

  @Post('payables/:id/payment')
  @RequirePermissions('finance.journal.create')
  settlePayableAlias(@Param('id') id: string, @Body() dto: SettleDocumentDto, @Req() req: AuthenticatedRequest) {
    return this.finance.settlePayable(id, dto, req.user.id);
  }

  @Get('suppliers/:supplierId/ledger')
  @RequirePermissions('finance.payable.read')
  supplierLedger(@Param('supplierId') supplierId: string) {
    return this.finance.getSupplierLedger(supplierId);
  }

  @Get('departments')
  @RequirePermissions('finance.report.read')
  departments() {
    return this.finance.listDepartments();
  }

  @Get('trial-balance')
  @RequirePermissions('finance.report.read')
  trialBalance() {
    return this.finance.trialBalance();
  }

  @Get('accounts/:id/ledger')
  @RequirePermissions('finance.report.read')
  ledger(@Param('id') id: string) {
    return this.finance.ledger(id);
  }

  @Get('financial-statements/income-statement')
  @RequirePermissions('finance.report.read')
  incomeStatement(@Query('periodId') periodId?: string) {
    return this.finance.incomeStatement(periodId);
  }

  @Get('income-statement')
  @RequirePermissions('finance.report.read')
  incomeStatementAlias(@Query('periodId') periodId?: string) {
    return this.finance.incomeStatement(periodId);
  }

  @Get('financial-statements/balance-sheet')
  @RequirePermissions('finance.report.read')
  balanceSheet(@Query('asOfDate') asOfDate?: string) {
    return this.finance.balanceSheet(asOfDate);
  }

  @Get('balance-sheet')
  @RequirePermissions('finance.report.read')
  balanceSheetAlias(@Query('asOfDate') asOfDate?: string) {
    return this.finance.balanceSheet(asOfDate);
  }

  @Get('journals')
  @RequirePermissions('finance.report.read')
  journals() {
    return this.finance.listJournals();
  }

  @Get('expenses')
  @RequirePermissions('finance.expense.create')
  expenses() {
    return this.finance.listExpenses();
  }

  @Get('bank-transactions')
  @RequirePermissions('finance.bank.transaction.create')
  bankTransactions() {
    return this.finance.listBankTransactions();
  }

  @Get('reconciliations')
  @RequirePermissions('finance.reconciliation.create')
  reconciliations() {
    return this.finance.listReconciliations();
  }

  @Get('notifications')
  @RequirePermissions('finance.receivable.read')
  notifications(
    @Query('department') department?: string,
    @Query('category') category?: string,
  ) {
    return this.finance.listOperationalNotifications(department, category);
  }

  @Post('notifications/record')
  @RequirePermissions('finance.journal.create')
  recordNotification(@Body() dto: RecordOperationalJobDto, @Req() req: AuthenticatedRequest) {
    return this.finance.recordOperationalJobAsReceivable(dto, req.user.id);
  }

  @Post('operational-jobs/record')
  @RequirePermissions('finance.journal.create')
  recordOperationalJob(@Body() dto: RecordOperationalJobDto, @Req() req: AuthenticatedRequest) {
    return this.finance.recordOperationalJobAsReceivable(dto, req.user.id);
  }

  @Post('journal-entries')
  @RequirePermissions('finance.journal.create')
  createJournal(@Body() dto: PostJournalEntryDto, @Req() req: AuthenticatedRequest) {
    return this.finance.createJournalDraft(dto, req.user.id);
  }

  @Post('journals')
  @RequirePermissions('finance.journal.create')
  createJournalAlias(@Body() dto: PostJournalEntryDto, @Req() req: AuthenticatedRequest) {
    return this.finance.createJournalDraft(dto, req.user.id);
  }

  @Post('journal-entries/:id/post')
  @RequirePermissions('finance.journal.post')
  postJournal(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.finance.postJournalEntry(id, req.user.id);
  }

  @Post('journals/:id/post')
  @RequirePermissions('finance.journal.post')
  postJournalAlias(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.finance.postJournalEntry(id, req.user.id);
  }

  @Post('journal-entries/:id/reverse')
  @RequirePermissions('finance.journal.reverse')
  reverseJournal(@Param('id') id: string, @Body('description') description: string, @Req() req: AuthenticatedRequest) {
    return this.finance.reverseJournalEntry(id, req.user.id, description);
  }

  @Post('journals/:id/reverse')
  @RequirePermissions('finance.journal.reverse')
  reverseJournalAlias(@Param('id') id: string, @Body('reason') reason: string, @Req() req: AuthenticatedRequest) {
    return this.finance.reverseJournalEntry(id, req.user.id, reason);
  }

  @Post('expenses')
  @RequirePermissions('finance.expense.create')
  createExpense(@Body() dto: CreateExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.finance.createExpense(dto, req.user.id);
  }

  @Post('expenses/:id/approve')
  @RequirePermissions('finance.expense.approve')
  approveExpense(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.finance.approveExpense(id, req.user.id);
  }

  @Post('expenses/:id/post')
  @RequirePermissions('finance.expense.post')
  postExpense(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.finance.postExpense(id, req.user.id);
  }

  @Post('bank-transactions')
  @RequirePermissions('finance.bank.transaction.create')
  bankTransaction(@Body() dto: CreateBankTransactionDto, @Req() req: AuthenticatedRequest) {
    return this.finance.createBankTransaction(dto, req.user.id);
  }

  @Post('reconciliations')
  @RequirePermissions('finance.reconciliation.create')
  reconcile(@Body() dto: ReconcileDto, @Req() req: AuthenticatedRequest) {
    return this.finance.reconcile(dto, req.user.id);
  }
}
