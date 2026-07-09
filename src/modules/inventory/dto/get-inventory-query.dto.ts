import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class GetInventoryQueryDto {
  @ApiPropertyOptional({
    example: 12,
    description: 'Variant option value ID when reading variant stock',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optionValueId?: number;
}
