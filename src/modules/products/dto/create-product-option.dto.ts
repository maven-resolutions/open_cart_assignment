import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ProductOptionTypeE } from '../../../common/enums/product-option-type.enum';
import { ProductOptionValueDto } from './product-option-value.dto';

export class CreateProductOptionDto {
  @ApiProperty({ example: 'Size' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ProductOptionTypeE, example: ProductOptionTypeE.SELECT })
  @IsEnum(ProductOptionTypeE)
  type: ProductOptionTypeE;

  @ApiProperty({ type: ProductOptionValueDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductOptionValueDto)
  values: ProductOptionValueDto[];
}
