import { Injectable } from '@nestjs/common';
import {
  INSUFFICIENT_STOCK_ERROR,
  OC_ID_TO_ORDER_STATUS,
  OcErrorBody,
  OcLoginResponse,
  OpenCartApiError,
  OrderDto,
  OrderHistoryEntryDto,
  OrderLineItemDto,
  OrderStatus,
  PaginatedResult,
  ProductDto,
  ProductVariantDto,
  StockInfoDto,
  LowStockAlertDto,
} from './opencart.types';

@Injectable()
export class OpenCartMapper {
  assertNoError(body: OcErrorBody, statusCode?: number): void {
    if (body.error) {
      const message =
        typeof body.error === 'string'
          ? body.error
          : Object.values(body.error).join('; ');

      const isPermission =
        typeof body.error === 'object' &&
        ('permission' in body.error || 'ip' in body.error);

      const isInsufficientStock =
        typeof body.error === 'string' &&
        body.error.toLowerCase().includes('insufficient stock');

      if (isInsufficientStock) {
        throw new OpenCartApiError(message, INSUFFICIENT_STOCK_ERROR, statusCode);
      }

      throw new OpenCartApiError(
        message,
        isPermission ? 'PERMISSION_DENIED' : 'OPENCART_ERROR',
        statusCode,
      );
    }

    if (body.success === false) {
      throw new OpenCartApiError('OpenCart request failed', 'OPENCART_ERROR', statusCode);
    }
  }

  extractLoginToken(response: OcLoginResponse): string {
    if (response.error) {
      const message = Object.values(response.error).join('; ');
      throw new OpenCartApiError(message, 'AUTH_FAILED');
    }

    if (!response.api_token) {
      throw new OpenCartApiError(
        'OpenCart login succeeded but api_token is missing',
        'AUTH_FAILED',
      );
    }

    return response.api_token;
  }

  unwrapData<T>(body: Record<string, unknown>): T {
    if (body.data !== undefined) {
      return body.data as T;
    }
    return body as T;
  }

  mapProduct(raw: Record<string, unknown>): ProductDto {
    return {
      id: this.toNumber(raw.product_id ?? raw.id),
      name: String(raw.name ?? ''),
      model: String(raw.model ?? raw.sku ?? ''),
      price: this.toNumber(raw.price),
      quantity: this.toNumber(raw.quantity),
      status: this.toBoolean(raw.status),
      description: raw.description ? String(raw.description) : undefined,
    };
  }

  mapProductList(
    body: Record<string, unknown>,
    page: number,
    limit: number,
  ): PaginatedResult<ProductDto> {
    const data = this.unwrapData<Record<string, unknown>>(body);
    const products = this.extractArray(data, 'products').map((item) =>
      this.mapProduct(item),
    );

    return {
      items: products,
      total: this.toNumber(data.total ?? products.length),
      page,
      limit,
    };
  }

  mapVariant(raw: Record<string, unknown>, productId: number): ProductVariantDto {
    return {
      productId,
      optionId: this.toNumber(raw.option_id),
      optionName: String(raw.option_name ?? raw.name ?? ''),
      optionValueId: this.toNumber(raw.option_value_id),
      valueName: String(raw.value_name ?? raw.value ?? ''),
      priceModifier: this.toNumber(raw.price ?? raw.price_modifier),
      quantity: this.toNumber(raw.quantity),
    };
  }

  mapOrder(raw: Record<string, unknown>): OrderDto {
    const orderStatusId = this.toNumber(raw.order_status_id);
    const status = this.mapOrderStatus(orderStatusId);

    const lineItems = this.extractArray(raw, 'products').map((item) =>
      this.mapOrderLineItem(item),
    );

    return {
      id: this.toNumber(raw.order_id ?? raw.id),
      status,
      orderStatusId,
      firstName: String(raw.firstname ?? raw.first_name ?? ''),
      lastName: String(raw.lastname ?? raw.last_name ?? ''),
      email: String(raw.email ?? ''),
      total: this.toNumber(raw.total),
      dateAdded: String(raw.date_added ?? ''),
      lineItems,
    };
  }

  mapOrderList(
    body: Record<string, unknown>,
    page: number,
    limit: number,
  ): PaginatedResult<OrderDto> {
    const data = this.unwrapData<Record<string, unknown>>(body);
    const orders = this.extractArray(data, 'orders').map((item) =>
      this.mapOrder(item),
    );

    return {
      items: orders,
      total: this.toNumber(data.total ?? orders.length),
      page,
      limit,
    };
  }

  mapOrderHistory(body: Record<string, unknown>): OrderHistoryEntryDto[] {
    const data = this.unwrapData<Record<string, unknown>>(body);
    return this.extractArray(data, 'histories').map((entry) => {
      const orderStatusId = this.toNumber(entry.order_status_id);
      return {
        orderStatusId,
        status: this.mapOrderStatus(orderStatusId),
        comment: String(entry.comment ?? ''),
        dateAdded: String(entry.date_added ?? ''),
      };
    });
  }

  mapStock(raw: Record<string, unknown>): StockInfoDto {
    return {
      productId: this.toNumber(raw.product_id),
      quantity: this.toNumber(raw.quantity),
      optionValueId: raw.option_value_id
        ? this.toNumber(raw.option_value_id)
        : undefined,
    };
  }

  mapStockAlerts(body: Record<string, unknown>): LowStockAlertDto[] {
    const data = this.unwrapData<Record<string, unknown>>(body);
    return this.extractArray(data, 'alerts').map((item) => ({
      productId: this.toNumber(item.product_id),
      name: String(item.name ?? ''),
      model: String(item.model ?? ''),
      quantity: this.toNumber(item.quantity),
      threshold: this.toNumber(item.threshold),
    }));
  }

  mapOrderStatus(orderStatusId: number): OrderStatus {
    return OC_ID_TO_ORDER_STATUS[orderStatusId] ?? 'pending';
  }

  private mapOrderLineItem(raw: Record<string, unknown>): OrderLineItemDto {
    const optionValueIds = this.parseOptionValueIds(raw);

    return {
      orderProductId: this.toNumber(raw.order_product_id),
      productId: this.toNumber(raw.product_id),
      name: String(raw.name ?? ''),
      quantity: this.toNumber(raw.quantity),
      price: this.toNumber(raw.price),
      optionValueId: optionValueIds[0],
      optionValueIds: optionValueIds.length ? optionValueIds : undefined,
    };
  }

  private parseOptionValueIds(raw: Record<string, unknown>): number[] {
    if (Array.isArray(raw.option_value_ids)) {
      return raw.option_value_ids.map((id) => this.toNumber(id));
    }

    if (raw.option_value_id !== undefined && raw.option_value_id !== '') {
      return [this.toNumber(raw.option_value_id)];
    }

    return [];
  }

  private extractArray(
    source: Record<string, unknown>,
    key: string,
  ): Record<string, unknown>[] {
    const value = source[key];
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value as Record<string, unknown>[];
    }
    return [value as Record<string, unknown>];
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value === '1' || value.toLowerCase() === 'true';
    }
    return Number(value) === 1;
  }
}
