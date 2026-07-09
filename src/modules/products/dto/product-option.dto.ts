import { ApiProperty } from '@nestjs/swagger';

/** Product variant / option value exposed by GET /products/:id/variants. */
export class ProductOptionDto {
  @ApiProperty({ example: 42 })
  productId: number;

  @ApiProperty({ example: 11 })
  optionId: number;

  @ApiProperty({ example: 'Color' })
  optionName: string;

  @ApiProperty({ example: 23 })
  optionValueId: number;

  @ApiProperty({ example: 'Black' })
  valueName: string;

  @ApiProperty({ example: 5.0 })
  priceModifier: number;

  @ApiProperty({ example: 25 })
  quantity: number;
}
