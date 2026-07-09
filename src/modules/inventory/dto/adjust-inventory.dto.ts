import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty({
    example: -5,
    description: 'Quantity change applied to current stock (negative to deduct)',
  })
  @Type(() => Number)
  @IsInt()
  adjustment!: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'Variant option value ID when adjusting variant stock',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optionValueId?: number;
}
