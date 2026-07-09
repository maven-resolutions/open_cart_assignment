import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InsufficientStockException } from '../../common/exceptions/insufficient-stock.exception';
import { InventoryAuditLog } from '../../database/models/inventory-audit-log.model';
import { InventoryAuditSource } from '../../database/models/inventory.types';
import { OpenCartClient } from '../../integrations/opencart/opencart.client';
import {
  INSUFFICIENT_STOCK_ERROR,
  LowStockAlertDto,
  OpenCartApiError,
  PaginatedResult,
  StockInfoDto,
} from '../../integrations/opencart/opencart.types';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { InventoryItemDto } from './inventory.types';

@Injectable()
export class InventoryService {
  constructor(
    private readonly openCartClient: OpenCartClient,
    private readonly configService: ConfigService,
    @Inject(InventoryAuditLog)
    private readonly auditLogModel: typeof InventoryAuditLog,
  ) {}

  async findAll(
    query: ListInventoryQueryDto,
  ): Promise<PaginatedResult<InventoryItemDto>> {
    try {
      const threshold = this.getLowStockThreshold();
      const result = await this.openCartClient.listProducts({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      });

      return {
        ...result,
        items: result.items.map((product) => ({
          productId: product.id,
          name: product.name,
          model: product.model,
          quantity: product.quantity,
          threshold,
          isLowStock: product.quantity < threshold,
        })),
      };
    } catch (error) {
      this.handleOpenCartError(error);
    }
  }

  async findOne(
    productId: number,
    optionValueId?: number,
  ): Promise<InventoryItemDto> {
    try {
      const stock = await this.openCartClient.getStock(
        productId,
        optionValueId,
      );
      const productMeta = optionValueId
        ? undefined
        : await this.tryGetProductMeta(productId);

      return this.toInventoryItem(stock, productMeta);
    } catch (error) {
      this.handleOpenCartError(error, 'Product not found');
    }
  }

  async adjust(
    productId: number,
    dto: AdjustInventoryDto,
  ): Promise<InventoryItemDto> {
    let current: StockInfoDto;

    try {
      current = await this.openCartClient.getStock(
        productId,
        dto.optionValueId,
      );
    } catch (error) {
      this.handleOpenCartError(error, 'Product not found');
    }

    const newQty = current.quantity + dto.adjustment;

    if (newQty < 0) {
      throw new InsufficientStockException();
    }

    try {
      const updated = await this.openCartClient.updateStock(
        productId,
        newQty,
        dto.optionValueId,
      );

      await this.auditLogModel.query().insert({
        productId,
        optionValueIds: dto.optionValueId ? [dto.optionValueId] : null,
        qtyBefore: current.quantity,
        qtyAfter: newQty,
        source: InventoryAuditSource.MANUAL_ADJUST,
      });

      return this.toInventoryItem(updated);
    } catch (error) {
      if (
        error instanceof OpenCartApiError &&
        error.code === INSUFFICIENT_STOCK_ERROR
      ) {
        throw new InsufficientStockException(error.message);
      }

      this.handleOpenCartError(error, 'Product not found');
    }
  }

  async getAlerts(): Promise<LowStockAlertDto[]> {
    try {
      const threshold = this.getLowStockThreshold();
      return await this.openCartClient.getLowStockAlerts(threshold);
    } catch (error) {
      this.handleOpenCartError(error);
    }
  }

  private getLowStockThreshold(): number {
    return this.configService.get<number>('inventory.lowStockThreshold') ?? 10;
  }

  private toInventoryItem(
    stock: StockInfoDto,
    productMeta?: { name: string; model: string },
  ): InventoryItemDto {
    const threshold = this.getLowStockThreshold();

    return {
      productId: stock.productId,
      name: productMeta?.name,
      model: productMeta?.model,
      quantity: stock.quantity,
      optionValueId: stock.optionValueId,
      threshold,
      isLowStock: stock.quantity < threshold,
    };
  }

  private async tryGetProductMeta(
    productId: number,
  ): Promise<{ name: string; model: string } | undefined> {
    try {
      const product = await this.openCartClient.getProduct(productId);
      return { name: product.name, model: product.model };
    } catch {
      return undefined;
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
        'OpenCart stock API route not found — verify the api/unisouk/stock ' +
        'extension is deployed and OPENCART_BASE_URL is correct'
      );
    }

    return error.message;
  }
}
