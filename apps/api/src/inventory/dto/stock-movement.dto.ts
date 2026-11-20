import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StockMovementDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  jobCardId?: string;

  @IsOptional()
  @IsString()
  requestId?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class StockTransferDto {
  @IsString()
  @IsNotEmpty()
  fromLocationId!: string;

  @IsString()
  @IsNotEmpty()
  toLocationId!: string;

  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class StockAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  newQuantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
