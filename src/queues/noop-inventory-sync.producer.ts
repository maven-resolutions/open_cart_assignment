import { Injectable } from '@nestjs/common';
import { InventorySyncProducer } from './inventory-sync-producer.interface';

/** Stub producer for C-18; replaced by BullMQ producer in C-20/C-21. */
@Injectable()
export class NoOpInventorySyncProducer implements InventorySyncProducer {
  async enqueue(_orderId: number): Promise<void> {
    // no-op until queue infrastructure lands in C-20
  }
}
