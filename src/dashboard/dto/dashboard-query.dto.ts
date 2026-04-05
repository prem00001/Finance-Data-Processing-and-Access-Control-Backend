import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum TrendGranularity {
  WEEK = 'week',
  MONTH = 'month',
}

export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Start of range (inclusive).' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'End of range (inclusive).' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ enum: TrendGranularity, default: TrendGranularity.MONTH })
  @IsOptional()
  @IsEnum(TrendGranularity)
  trend?: TrendGranularity = TrendGranularity.MONTH;

  @ApiPropertyOptional({ default: 10, description: 'Recent entries to return.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  recentLimit?: number = 10;
}
