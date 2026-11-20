import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString, Min, ValidateNested, IsNumber, ArrayMinSize } from 'class-validator';

export class JournalLineDto {
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  debit!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  credit!: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class PostJournalEntryDto {
  @IsDateString()
  entryDate!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;
}
