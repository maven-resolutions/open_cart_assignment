import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class ProductOptionValueDto {
  @ApiProperty({ example: 'Large' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 5.0 })
  @IsNumber()
  priceModifier: number;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @Min(0)
  quantity: number;
}
