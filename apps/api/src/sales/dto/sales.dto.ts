import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, MaxLength, Min, ValidateNested } from 'class-validator';

export class BranchQueryDto {
  @IsOptional() @IsString() @Length(1, 100) branchId?: string;
}

export class CreateCustomerDto {
  @IsString() @Length(1, 160) name!: string;
  @IsString() @Length(1, 40) phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
  @IsOptional() @IsString() @Length(5, 32) cnic?: string;
  @IsOptional() @IsString() @MaxLength(80) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(120) sourceId?: string;
}

export class CreateVehicleDto {
  @IsString() @Length(1, 40) registrationNo!: string;
  @IsOptional() @IsString() @MaxLength(80) vin?: string;
  @IsString() @Length(1, 80) make!: string;
  @IsString() @Length(1, 80) model!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1886) modelYear?: number;
  @IsOptional() @IsString() @MaxLength(40) color?: string;
  @IsOptional() @Type(() => Number) @Min(0) price?: number;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() @MaxLength(80) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(120) sourceId?: string;
  @IsOptional() @IsNumber() @Min(0) salePrice?: number;
}

export class CreateLeadDto {
  @IsString() @Length(1, 160) name!: string;
  @IsString() @Length(1, 40) phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(160) interest?: string;
  @IsOptional() @IsIn(['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST']) status?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() @MaxLength(80) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(120) sourceId?: string;
  @IsOptional() @IsString() ownerId?: string;
}

export class CreateBookingDto {
  @IsOptional() @IsString() @Length(1, 50) bookingNo?: string;
  @IsDateString() bookingDate!: string;
  @IsOptional() @IsIn(['RESERVED', 'CONFIRMED', 'INVOICED', 'DELIVERED', 'COMPLETED', 'CANCELLED']) status?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() vehicleId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsString() @MaxLength(80) sourceType?: string;
  @IsOptional() @IsString() @MaxLength(120) sourceId?: string;
  @IsOptional() @IsNumber() @Min(0) totalAmount?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
}

export class UpdateBookingStatusDto {
  @IsIn(['RESERVED', 'CONFIRMED', 'INVOICED', 'DELIVERED', 'COMPLETED', 'CANCELLED']) status!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateLeadActivityDto {
  @IsIn(['FOLLOW_UP', 'NOTE', 'CALL', 'EMAIL', 'SMS', 'MEETING']) type!: string;
  @IsOptional() @IsString() @MaxLength(160) subject?: string;
  @IsString() @Length(1, 1000) notes!: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class ScheduleLineDto {
  @IsInt() @Min(1) installmentNo!: number;
  @IsDateString() dueDate!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreatePaymentScheduleDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ScheduleLineDto) lines!: ScheduleLineDto[];
}

export class CreateSalesPaymentDto {
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() scheduleId?: string;
  @IsOptional() @IsIn(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']) paymentMethod?: string;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsOptional() @IsIn(['RECEIPT', 'REFUND']) type?: string;
}

export class CreateBookingRequestDto {
  @IsIn(['BOOKING_APPROVAL', 'CANCELLATION', 'REFUND', 'DEDUCTION', 'DISCOUNT', 'ALLOCATION_CHANGE']) type!: string;
  @IsString() @Length(1, 1000) reason!: string;
  @IsOptional() @IsNumber() @Min(0.01) amount?: number;
  @IsOptional() @IsString() vehicleId?: string;
}

export class DecideBookingRequestDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateSalesInvoiceDto {
  @IsOptional() @IsNumber() @Min(0) tax?: number;
}

export class CreateSalesDeliveryDto {
  @IsOptional() @IsDateString() deliveredAt?: string;
  @IsOptional() @IsString() @MaxLength(160) deliveredTo?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateBookingDocumentDto {
  @IsString() @Length(1, 80) documentType!: string;
  @IsOptional() @IsString() @MaxLength(120) attachmentId?: string;
  @IsOptional() @IsString() @MaxLength(120) referenceNo?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
