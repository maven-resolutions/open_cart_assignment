import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InventorySyncProducer } from './inventory-sync-producer.interface';
import {
  INVENTORY_SYNC_JOB_NAME,
  INVENTORY_SYNC_QUEUE,
} from './queue.constants';

export interface InventorySyncJobData {
  orderId: number;
}

@Injectable()
export class InventorySyncQueueProducer implements InventorySyncProducer {
  constructor(
    @InjectQueue(INVENTORY_SYNC_QUEUE)
    private readonly inventorySyncQueue: Queue<InventorySyncJobData>,
  ) {}

  async enqueue(orderId: number): Promise<void> {
    await this.inventorySyncQueue.add(
      INVENTORY_SYNC_JOB_NAME,
      { orderId },
      { jobId: `sync-order-${orderId}` },
    );
  }
}
