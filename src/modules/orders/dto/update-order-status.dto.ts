import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatusE } from '../../../common/enums/order-status.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatusE, example: OrderStatusE.PROCESSING })
  @IsEnum(OrderStatusE)
  status!: OrderStatusE;

  @ApiPropertyOptional({ example: 'Order moved to processing' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
