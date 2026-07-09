import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { OpenCartAuthService } from './opencart-auth.service';
import { OpenCartMapper } from './opencart.mapper';
import {
  CreateProductPayload,
  INSUFFICIENT_STOCK_ERROR,
  ListOrdersParams,
  ListProductsParams,
  LowStockAlertDto,
  OcErrorBody,
  OPENCART_ROUTES,
  OpenCartApiError,
  OpenCartRoute,
  OrderDto,
  OrderHistoryEntryDto,
  OrderStatus,
  ORDER_STATUS_TO_OC_ID,
  PaginatedResult,
  ProductDto,
  ProductVariantDto,
  StockInfoDto,
  UpdateProductPayload,
} from './opencart.types';

interface RequestOptions {
  skipAuth?: boolean;
  isRetryAfterAuth?: boolean;
}

@Injectable()
export class OpenCartClient {
  private readonly logger = new Logger(OpenCartClient.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly authService: OpenCartAuthService,
    private readonly mapper: OpenCartMapper,
  ) {}

  async listProducts(
    params: ListProductsParams = {},
  ): Promise<PaginatedResult<ProductDto>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.PRODUCTS_LIST,
      {
        page: String(page),
        limit: String(limit),
      },
    );

    return this.mapper.mapProductList(body, page, limit);
  }

  async getProduct(productId: number): Promise<ProductDto> {
    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.PRODUCT_INFO,
      { product_id: String(productId) },
    );

    const data = this.mapper.unwrapData<Record<string, unknown>>(body);
    return this.mapper.mapProduct(data);
  }

  async createProduct(payload: CreateProductPayload): Promise<ProductDto> {
    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.PRODUCT_ADD,
      {
        name: payload.name,
        model: payload.model,
        price: String(payload.price),
        quantity: String(payload.quantity),
        status: payload.status === false ? '0' : '1',
        ...(payload.description ? { description: payload.description } : {}),
      },
    );

    const data = this.mapper.unwrapData<Record<string, unknown>>(body);
    const product = this.mapper.mapProduct(data);

    if (product.id <= 0) {
      throw new OpenCartApiError(
        'OpenCart create product returned an invalid product_id',
        'OPENCART_ERROR',
      );
    }

    return product;
  }

  async updateProduct(
    productId: number,
    payload: UpdateProductPayload,
  ): Promise<ProductDto> {
    const fields: Record<string, string> = {
      product_id: String(productId),
    };

    if (payload.name !== undefined) {
      fields.name = payload.name;
    }
    if (payload.model !== undefined) {
      fields.model = payload.model;
    }
    if (payload.price !== undefined) {
      fields.price = String(payload.price);
    }
    if (payload.quantity !== undefined) {
      fields.quantity = String(payload.quantity);
    }
    if (payload.status !== undefined) {
      fields.status = payload.status ? '1' : '0';
    }
    if (payload.description !== undefined) {
      fields.description = payload.description;
    }

    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.PRODUCT_EDIT,
      fields,
    );

    const data = this.mapper.unwrapData<Record<string, unknown>>(body);
    return this.mapper.mapProduct(data);
  }

  async deleteProduct(productId: number): Promise<void> {
    await this.post<Record<string, unknown>>(OPENCART_ROUTES.PRODUCT_DELETE, {
      product_id: String(productId),
    });
  }

  async listProductVariants(productId: number): Promise<ProductVariantDto[]> {
    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.PRODUCT_OPTIONS,
      { product_id: String(productId) },
    );

    const data = this.mapper.unwrapData<Record<string, unknown>>(body);
    const options = Array.isArray(data.options)
      ? (data.options as Record<string, unknown>[])
      : [];

    return options.map((item) => this.mapper.mapVariant(item, productId));
  }

  async listOrders(
    params: ListOrdersParams = {},
  ): Promise<PaginatedResult<OrderDto>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const fields: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };

    if (params.status) {
      fields.order_status_id = String(ORDER_STATUS_TO_OC_ID[params.status]);
    }
    if (params.dateFrom) {
      fields.date_from = params.dateFrom;
    }
    if (params.dateTo) {
      fields.date_to = params.dateTo;
    }

    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.ORDERS_LIST,
      fields,
    );

    return this.mapper.mapOrderList(body, page, limit);
  }

  async getOrder(orderId: number): Promise<OrderDto> {
    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.ORDER_INFO,
      {
        order_id: String(orderId),
      },
    );

    return this.mapper.mapOrder(body);
  }

  async getOrderHistory(orderId: number): Promise<OrderHistoryEntryDto[]> {
    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.ORDER_HISTORY,
      { order_id: String(orderId) },
    );

    return this.mapper.mapOrderHistory(body);
  }

  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    comment?: string,
  ): Promise<void> {
    const orderStatusId = ORDER_STATUS_TO_OC_ID[status];
    if (orderStatusId === undefined) {
      throw new OpenCartApiError(
        `Unknown order status: ${status}`,
        'VALIDATION_ERROR',
      );
    }

    const fields: Record<string, string> = {
      order_id: String(orderId),
      order_status_id: String(orderStatusId),
    };

    if (comment) {
      fields.comment = comment;
    }

    await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.ORDER_EDIT,
      fields,
    );
  }

  async getStock(
    productId: number,
    optionValueId?: number,
  ): Promise<StockInfoDto> {
    const fields: Record<string, string> = {
      product_id: String(productId),
    };

    if (optionValueId !== undefined) {
      fields.option_value_id = String(optionValueId);
    }

    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.STOCK_INFO,
      fields,
    );

    const data = this.mapper.unwrapData<Record<string, unknown>>(body);
    return this.mapper.mapStock(data);
  }

  async updateStock(
    productId: number,
    quantity: number,
    optionValueId?: number,
  ): Promise<StockInfoDto> {
    const fields: Record<string, string> = {
      product_id: String(productId),
      quantity: String(quantity),
    };

    if (optionValueId !== undefined) {
      fields.option_value_id = String(optionValueId);
    }

    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.STOCK_EDIT,
      fields,
    );

    const data = this.mapper.unwrapData<Record<string, unknown>>(body);
    return this.mapper.mapStock(data);
  }

  async getLowStockAlerts(threshold?: number): Promise<LowStockAlertDto[]> {
    const fields: Record<string, string> = {};

    if (threshold !== undefined) {
      fields.threshold = String(threshold);
    }

    const body = await this.post<Record<string, unknown>>(
      OPENCART_ROUTES.STOCK_ALERTS,
      fields,
    );

    return this.mapper.mapStockAlerts(body);
  }

  private async post<T extends OcErrorBody>(
    route: OpenCartRoute,
    data: Record<string, string>,
    options: RequestOptions = {},
  ): Promise<T> {
    const maxRetries =
      this.configService.get<number>('opencart.maxRetries') ?? 3;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executePost<T>(route, data, options);
      } catch (error) {
        lastError = error;

        if (this.shouldReauth(error) && !options.isRetryAfterAuth) {
          this.logger.warn('OpenCart permission error — re-authenticating', {
            route,
          });
          await this.authService.refreshToken();
          return this.post<T>(route, data, {
            ...options,
            isRetryAfterAuth: true,
          });
        }

        if (!this.isRetryable(error) || attempt >= maxRetries) {
          throw error;
        }

        const delayMs = Math.pow(2, attempt) * 500;
        this.logger.warn('OpenCart request failed — retrying', {
          route,
          attempt: attempt + 1,
          maxRetries,
          delayMs,
        });
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  private async executePost<T extends OcErrorBody>(
    route: OpenCartRoute,
    data: Record<string, string>,
    options: RequestOptions,
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    let url = `${baseUrl}/index.php?route=${route}`;

    if (!options.skipAuth) {
      const token = await this.authService.getToken();
      url += `&api_token=${encodeURIComponent(token)}`;
    }

    const body = new URLSearchParams(data);

    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(url, body.toString()),
      );

      this.mapper.assertNoError(response.data, response.status);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error, route);
    }
  }

  private normalizeError(
    error: unknown,
    route: OpenCartRoute,
  ): OpenCartApiError {
    if (error instanceof OpenCartApiError) {
      return error;
    }

    if (this.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as OcErrorBody | undefined;

      if (data) {
        try {
          this.mapper.assertNoError(data, status);
        } catch (mapped) {
          if (mapped instanceof OpenCartApiError) {
            return mapped;
          }
        }
      }

      const message = this.sanitizeErrorMessage(
        data?.error
          ? typeof data.error === 'string'
            ? data.error
            : Object.values(data.error).join('; ')
          : (error.message ?? 'OpenCart request failed'),
      );

      return new OpenCartApiError(message, 'HTTP_ERROR', status);
    }

    const message =
      error instanceof Error ? error.message : 'OpenCart request failed';
    this.logger.error('Unexpected OpenCart client error', { route, message });
    return new OpenCartApiError(message, 'UNKNOWN_ERROR');
  }

  private shouldReauth(error: unknown): boolean {
    if (error instanceof OpenCartApiError) {
      return error.code === 'PERMISSION_DENIED' || error.statusCode === 401;
    }

    if (this.isAxiosError(error)) {
      return error.response?.status === 401;
    }

    return false;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof OpenCartApiError) {
      if (error.code === 'PERMISSION_DENIED' || error.code === 'AUTH_FAILED') {
        return false;
      }
      if (error.code === INSUFFICIENT_STOCK_ERROR) {
        return false;
      }
      const status = error.statusCode;
      return status === undefined || status >= 500;
    }

    if (this.isAxiosError(error)) {
      const status = error.response?.status;
      if (!status) {
        return true;
      }
      return status >= 500;
    }

    return true;
  }

  private isAxiosError(error: unknown): error is AxiosError<OcErrorBody> {
    return (
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error &&
      (error as AxiosError).isAxiosError === true
    );
  }

  private getBaseUrl(): string {
    const baseUrl = this.configService.get<string>('opencart.baseUrl');
    if (!baseUrl) {
      throw new OpenCartApiError(
        'OPENCART_BASE_URL is not configured',
        'CONFIG_ERROR',
      );
    }
    return baseUrl.replace(/\/$/, '');
  }

  private sanitizeErrorMessage(message: string): string {
    const apiKey = this.configService.get<string>('opencart.apiKey');
    if (apiKey && message.includes(apiKey)) {
      return message.replaceAll(apiKey, '[REDACTED]');
    }
    return message;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
