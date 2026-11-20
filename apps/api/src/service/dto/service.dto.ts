import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsNumber, Min, ValidateNested, IsIn, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJobCardDto { @IsString() branchId!: string; @IsString() customerId!: string; @IsString() vehicleId!: string; @IsOptional() @IsString() complaint?: string; @IsOptional() @IsInt() @Min(0) odometer?: number; @IsOptional() @IsString() packageId?: string; @IsOptional() @IsBoolean() isWarranty?: boolean; @IsOptional() @IsString() warrantyRef?: string; }
export class EstimateLineDto { @IsString() description!: string; @IsNumber() @Min(0) quantity!: number; @IsNumber() @Min(0) unitPrice!: number; @IsString() @IsIn(['LABOR','PART','OTHER']) lineType!: string; @IsOptional() @IsString() partId?: string; }
export class CreateEstimateDto { @IsArray() @ValidateNested({ each: true }) @Type(() => EstimateLineDto) lines!: EstimateLineDto[]; @IsOptional() @IsString() notes?: string; }
export class AssignTechnicianDto { @IsString() technicianId!: string; }
export class RequestPartsDto { @IsString() locationId!: string; @IsArray() @ValidateNested({ each: true }) @Type(() => PartRequestLineDto) lines!: PartRequestLineDto[]; }
export class PartRequestLineDto { @IsString() partId!: string; @IsNumber() @Min(0.0001) quantity!: number; }
export class RecordLaborDto { @IsString() description!: string; @IsNumber() @Min(0.01) hours!: number; @IsNumber() @Min(0) rate!: number; @IsOptional() @IsString() technicianId?: string; }
export class UpdateStatusDto { @IsString() @IsIn(['OPEN','ESTIMATED','APPROVED','IN_PROGRESS','WAITING_PARTS','QUALITY_CHECK','READY_FOR_INVOICE','INVOICED','CLOSED','CANCELLED']) status!: string; }
export class InspectionDto { @IsObject() checklist!: Record<string, unknown>; @IsBoolean() passed!: boolean; @IsOptional() @IsString() notes?: string; }
export class ServiceCheckEventDto { @IsIn(['CHECK_IN', 'CHECK_OUT']) type!: string; @IsOptional() @IsInt() @Min(0) odometer?: number; @IsOptional() @IsString() fuelLevel?: string; @IsOptional() @IsObject() checklist?: Record<string, unknown>; @IsOptional() @IsString() notes?: string; }
export class CreateServicePackageDto { @IsString() code!: string; @IsString() name!: string; @IsNumber() @Min(0) price!: number; @IsOptional() @IsString() description?: string; }
