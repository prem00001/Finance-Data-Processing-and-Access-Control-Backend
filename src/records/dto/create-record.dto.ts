import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntryType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateRecordDto {
  @ApiProperty({ example: '150.75' })
  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiProperty({ enum: EntryType })
  @IsEnum(EntryType)
  type!: EntryType;

  @ApiProperty({ example: 'Food' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  category!: string;

  @ApiProperty({ example: '2026-04-01T12:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  occurredAt!: Date;

  @ApiPropertyOptional({ example: 'Weekly groceries' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Owner user id (admin may set; defaults to current user).' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
