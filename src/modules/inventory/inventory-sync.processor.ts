import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { InventorySyncJobData } from '../../queues/inventory-sync.producer';
import { INVENTORY_SYNC_QUEUE } from '../../queues/queue.constants';
import { InventorySyncInsufficientStockError } from './inventory-sync.errors';
import { InventorySyncService } from './inventory-sync.service';

@Processor(INVENTORY_SYNC_QUEUE)
export class InventorySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(InventorySyncProcessor.name);

  constructor(private readonly inventorySyncService: InventorySyncService) {
    super();
  }

  async process(job: Job<InventorySyncJobData>): Promise<void> {
    const { orderId } = job.data;

    this.logger.log('Processing inventory sync job', {
      orderId,
      bullJobId: job.id,
      attempt: job.attemptsMade + 1,
    });

    try {
      await this.inventorySyncService.processOrder(orderId);
    } catch (error) {
      if (error instanceof InventorySyncInsufficientStockError) {
        throw new UnrecoverableError(error.message);
      }

      throw error;
    }
  }
}
