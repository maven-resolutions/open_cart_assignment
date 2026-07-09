export class InventorySyncInsufficientStockError extends Error {
  constructor(
    message: string,
    readonly productId: number,
    readonly orderedQty: number,
    readonly currentQty: number,
  ) {
    super(message);
    this.name = 'InventorySyncInsufficientStockError';
  }
}
