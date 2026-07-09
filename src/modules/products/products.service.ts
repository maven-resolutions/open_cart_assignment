import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpenCartClient } from '../../integrations/opencart/opencart.client';
import {
  OpenCartApiError,
  PaginatedResult,
  ProductDto,
  ProductVariantDto,
} from '../../integrations/opencart/opencart.types';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly openCartClient: OpenCartClient) {}

  async findAll(
    query: ListProductsQueryDto,
  ): Promise<PaginatedResult<ProductDto>> {
    try {
      return await this.openCartClient.listProducts({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      });
    } catch (error) {
      this.handleOpenCartError(error);
    }
  }

  async findOne(productId: number): Promise<ProductDto> {
    try {
      return await this.openCartClient.getProduct(productId);
    } catch (error) {
      this.handleOpenCartError(error, 'Product not found');
    }
  }

  async create(dto: CreateProductDto): Promise<ProductDto> {
    try {
      return await this.openCartClient.createProduct({
        name: dto.name,
        model: dto.model,
        price: dto.price,
        quantity: dto.quantity,
        status: dto.status ?? true,
        description: dto.description,
      });
    } catch (error) {
      this.handleOpenCartError(error);
    }
  }

  async update(productId: number, dto: UpdateProductDto): Promise<ProductDto> {
    try {
      return await this.openCartClient.updateProduct(productId, dto);
    } catch (error) {
      this.handleOpenCartError(error, 'Product not found');
    }
  }

  async remove(productId: number): Promise<void> {
    try {
      await this.openCartClient.deleteProduct(productId);
    } catch (error) {
      this.handleOpenCartError(error, 'Product not found');
    }
  }

  async listVariants(productId: number): Promise<ProductVariantDto[]> {
    try {
      await this.openCartClient.getProduct(productId);
      return await this.openCartClient.listProductVariants(productId);
    } catch (error) {
      this.handleOpenCartError(error, 'Product not found');
    }
  }

  private handleOpenCartError(error: unknown, notFoundMessage?: string): never {
    if (error instanceof OpenCartApiError) {
      if (notFoundMessage && this.isNotFoundError(error)) {
        throw new NotFoundException(notFoundMessage);
      }
      throw new BadGatewayException(this.formatUpstreamMessage(error));
    }

    throw error;
  }

  private isNotFoundError(error: OpenCartApiError): boolean {
    const message = error.message.toLowerCase();
    if (
      message.includes('not found') ||
      message.includes('invalid product') ||
      message.includes('unknown product')
    ) {
      return true;
    }

    return error.statusCode === 404;
  }

  private formatUpstreamMessage(error: OpenCartApiError): string {
    if (error.statusCode === 404) {
      return (
        'OpenCart catalog API route not found — verify the api/unisouk ' +
        'extension is deployed and OPENCART_BASE_URL is correct'
      );
    }

    return error.message;
  }
}
