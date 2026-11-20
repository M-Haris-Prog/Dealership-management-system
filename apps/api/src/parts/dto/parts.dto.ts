import { IsArray, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartDto {
  @IsString() @MaxLength(80) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsNumber() @Min(0) reorderLevel?: number;
  @IsOptional() @IsNumber() @Min(0) maxStockLevel?: number;
  @IsOptional() @IsString() @MaxLength(50) categoryCode?: string;
}

export class CreatePartCategoryDto {
  @IsString() @MaxLength(50) code!: string;
  @IsString() @MaxLength(120) name!: string;
}

export class CreateSupplierDto {
  @IsString() @MaxLength(50) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(255) address?: string;
}

export class StockCommandDto {
  @IsString() @MaxLength(30) locationId!: string;
  @IsString() @MaxLength(80) itemCode!: string;
  @IsPositive() quantity!: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() @MaxLength(80) jobCardId?: string;
  @IsOptional() @IsString() @MaxLength(80) requestId?: string;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

export class StockTransferCommandDto {
  @IsString() @MaxLength(30) fromLocationId!: string;
  @IsString() @MaxLength(30) toLocationId!: string;
  @IsString() @MaxLength(80) itemCode!: string;
  @IsPositive() quantity!: number;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

export class StockAdjustmentCommandDto {
  @IsString() @MaxLength(30) locationId!: string;
  @IsString() @MaxLength(80) itemCode!: string;
  @Min(0) newQuantity!: number;
  @IsOptional() @IsString() @MaxLength(120) reason?: string;
}

export class CreatePurchaseOrderLineDto {
  @IsString() @MaxLength(80) partCode!: string;
  @IsPositive() quantity!: number;
  @IsPositive() unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsString() @MaxLength(50) supplierId!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];
}

export class ReceivePurchaseOrderDto {
  @IsString() @MaxLength(30) locationId!: string;
}
