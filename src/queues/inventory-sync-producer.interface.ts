export const INVENTORY_SYNC_PRODUCER = Symbol('INVENTORY_SYNC_PRODUCER');

export interface InventorySyncProducer {
  enqueue(orderId: number): Promise<void>;
}
