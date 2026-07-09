export interface InventoryItemDto {
  productId: number;
  name?: string;
  model?: string;
  quantity: number;
  isLowStock: boolean;
  threshold: number;
  optionValueId?: number;
}
