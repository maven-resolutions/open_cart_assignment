/** OpenCart 3 catalog API route identifiers (index.php?route=…). */
export const OPENCART_ROUTES = {
  LOGIN: 'api/login',
  ORDER_INFO: 'api/order/info',
  ORDER_HISTORY: 'api/order/history',
  ORDER_EDIT: 'api/order/edit',
  PRODUCTS_LIST: 'api/unisouk/products',
  PRODUCT_INFO: 'api/unisouk/products/info',
  PRODUCT_ADD: 'api/unisouk/products/add',
  PRODUCT_EDIT: 'api/unisouk/products/edit',
  PRODUCT_DELETE: 'api/unisouk/products/delete',
  PRODUCT_OPTIONS: 'api/unisouk/products/options',
  ORDERS_LIST: 'api/unisouk/orders',
  STOCK_INFO: 'api/unisouk/stock/info',
  STOCK_EDIT: 'api/unisouk/stock/edit',
  STOCK_ALERTS: 'api/unisouk/stock/alerts',
} as const;

export type OpenCartRoute =
  (typeof OPENCART_ROUTES)[keyof typeof OPENCART_ROUTES];

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'complete'
  | 'cancelled';

export const ORDER_STATUS_TO_OC_ID: Record<OrderStatus, number> = {
  pending: 1,
  processing: 2,
  shipped: 3,
  complete: 5,
  cancelled: 7,
};

export const OC_ID_TO_ORDER_STATUS: Record<number, OrderStatus> = {
  1: 'pending',
  2: 'processing',
  3: 'shipped',
  5: 'complete',
  7: 'cancelled',
};

/** Normalized product returned by the integration layer. */
export interface ProductDto {
  id: number;
  name: string;
  model: string;
  price: number;
  quantity: number;
  status: boolean;
  description?: string;
  variants?: ProductVariantDto[];
}

/** Product variant / option value row. */
export interface ProductVariantDto {
  productId: number;
  optionId: number;
  optionName: string;
  optionValueId: number;
  valueName: string;
  priceModifier: number;
  quantity: number;
}

export interface OrderLineItemDto {
  orderProductId: number;
  productId: number;
  name: string;
  quantity: number;
  price: number;
  optionValueId?: number;
  optionValueIds?: number[];
}

/** Normalized order returned by the integration layer. */
export interface OrderDto {
  id: number;
  status: OrderStatus;
  orderStatusId: number;
  firstName: string;
  lastName: string;
  email: string;
  total: number;
  dateAdded: string;
  lineItems: OrderLineItemDto[];
}

export interface OrderHistoryEntryDto {
  orderStatusId: number;
  status: OrderStatus;
  comment: string;
  dateAdded: string;
}

export interface StockInfoDto {
  productId: number;
  quantity: number;
  optionValueId?: number;
}

export interface LowStockAlertDto {
  productId: number;
  name: string;
  model: string;
  quantity: number;
  threshold: number;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
}

export interface ListOrdersParams {
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateProductPayload {
  name: string;
  model: string;
  price: number;
  quantity: number;
  status?: boolean;
  description?: string;
  options?: CreateProductOptionPayload[];
}

export interface CreateProductOptionPayload {
  name: string;
  type: 'select' | 'radio';
  values: CreateProductOptionValuePayload[];
}

export interface CreateProductOptionValuePayload {
  name: string;
  priceModifier: number;
  quantity: number;
}

export interface UpdateProductPayload {
  name?: string;
  model?: string;
  price?: number;
  quantity?: number;
  status?: boolean;
  description?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Raw OpenCart login response shape. */
export interface OcLoginResponse {
  success?: string;
  api_token?: string;
  error?: Record<string, string>;
}

/** Generic OpenCart error body (native + custom extension). */
export interface OcErrorBody {
  error?: string | Record<string, string>;
  success?: boolean | string;
}

export class OpenCartApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'OpenCartApiError';
  }
}

export const INSUFFICIENT_STOCK_ERROR = 'INSUFFICIENT_STOCK';
