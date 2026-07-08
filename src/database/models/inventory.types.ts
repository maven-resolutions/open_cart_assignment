export enum InventorySyncJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum InventoryAuditSource {
  MANUAL_ADJUST = 'manual_adjust',
  ORDER_SYNC = 'order_sync',
}

export interface SyncJobLineItemProgress {
  productId: number;
  optionValueIds?: number[];
  deductedQty: number;
}

export interface SyncJobPayload {
  completedLineItems?: SyncJobLineItemProgress[];
}
