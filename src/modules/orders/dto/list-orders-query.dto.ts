import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatusE } from '../../../common/enums/order-status.enum';

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ enum: OrderStatusE, example: OrderStatusE.PENDING })
  @IsOptional()
  @IsEnum(OrderStatusE)
  status?: OrderStatusE;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'ISO date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'ISO date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
