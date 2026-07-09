import { Injectable } from '@nestjs/common';
import { InventorySyncProducer } from './inventory-sync-producer.interface';

/** Stub producer for C-18; replaced by BullMQ producer in C-20/C-21. */
@Injectable()
export class NoOpInventorySyncProducer implements InventorySyncProducer {
  enqueue(orderId: number): Promise<void> {
    void orderId;
    return Promise.resolve();
  }
}
