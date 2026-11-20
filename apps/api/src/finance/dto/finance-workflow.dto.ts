import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAccountDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsEnum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']) type!: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  @IsOptional() @IsString() parentId?: string;
}

export class CreatePeriodDto {
  @IsString() name!: string;
  @IsDateString() startsOn!: string;
  @IsDateString() endsOn!: string;
}

export class CreateExpenseDto {
  @IsDateString() expenseDate!: string;
  @IsString() description!: string;
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) amount!: number;
  @IsString() expenseAccountId!: string;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceId?: string;
}

export class CreateBankTransactionDto {
  @IsDateString() transactionDate!: string;
  @IsString() accountId!: string;
  @IsEnum(['RECEIPT', 'PAYMENT', 'TRANSFER', 'FEE', 'ADJUSTMENT']) type!: string;
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) amount!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceId?: string;
}

export class ReconcileDto {
  @IsString() accountId!: string;
  @IsDateString() statementDate!: string;
  @IsNumber({ maxDecimalPlaces: 4 }) statementBalance!: number;
  @IsArray() @IsString({ each: true }) bankTransactionIds!: string[];
}

export class ClosePeriodDto {
  @IsOptional() @IsArray() checklist?: string[];
}

export class ReopenPeriodDto {
  @IsOptional() @IsString() reason?: string;
}

export class RecordOperationalJobDto {
  @IsString() sourceType!: string;
  @IsString() sourceId!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() customerId?: string;
  @IsString() referenceNo!: string;
  @IsOptional() @IsString() description?: string;
}

export class SettleDocumentDto {
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) amount!: number;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() bankAccountId?: string;
}
