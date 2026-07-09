import { Inject, Injectable, Logger } from '@nestjs/common';
import { InventoryAuditLog } from '../../database/models/inventory-audit-log.model';
import { InventorySyncJob } from '../../database/models/inventory-sync-job.model';
import {
  InventoryAuditSource,
  InventorySyncJobStatus,
  SyncJobLineItemProgress,
  SyncJobPayload,
} from '../../database/models/inventory.types';
import { OpenCartClient } from '../../integrations/opencart/opencart.client';
import {
  INSUFFICIENT_STOCK_ERROR,
  OrderLineItemDto,
} from '../../integrations/opencart/opencart.types';
import { InventorySyncInsufficientStockError } from './inventory-sync.errors';

@Injectable()
export class InventorySyncService {
  private readonly logger = new Logger(InventorySyncService.name);

  constructor(
    private readonly openCartClient: OpenCartClient,
    @Inject(InventorySyncJob)
    private readonly syncJobModel: typeof InventorySyncJob,
    @Inject(InventoryAuditLog)
    private readonly auditLogModel: typeof InventoryAuditLog,
  ) {}

  async processOrder(orderId: number): Promise<void> {
    const job = await this.syncJobModel.query().findOne({ orderId });

    if (!job) {
      this.logger.warn('No sync job row found for order', { orderId });
      return;
    }

    if (job.status === InventorySyncJobStatus.COMPLETED) {
      return;
    }

    await job.$query().patch({
      status: InventorySyncJobStatus.PROCESSING,
      attempts: job.attempts + 1,
    });

    const order = await this.openCartClient.getOrder(orderId);
    const payload: SyncJobPayload = {
      completedLineItems: job.payload?.completedLineItems ?? [],
    };

    for (const lineItem of order.lineItems) {
      if (
        this.isLineItemCompleted(payload.completedLineItems ?? [], lineItem)
      ) {
        continue;
      }

      const optionValueId = this.resolveStockOptionValueId(lineItem);
      const current = await this.openCartClient.getStock(
        lineItem.productId,
        optionValueId,
      );

      if (current.quantity < lineItem.quantity) {
        await job.$query().patch({
          status: InventorySyncJobStatus.FAILED,
          errorCode: INSUFFICIENT_STOCK_ERROR,
        });

        throw new InventorySyncInsufficientStockError(
          `Insufficient stock for product ${lineItem.productId}`,
          lineItem.productId,
          lineItem.quantity,
          current.quantity,
        );
      }

      const newQty = current.quantity - lineItem.quantity;
      await this.openCartClient.updateStock(
        lineItem.productId,
        newQty,
        optionValueId,
      );

      await this.auditLogModel.query().insert({
        orderId,
        productId: lineItem.productId,
        optionValueIds: this.resolveOptionValueIds(lineItem),
        qtyBefore: current.quantity,
        qtyAfter: newQty,
        source: InventoryAuditSource.ORDER_SYNC,
      });

      const progress: SyncJobLineItemProgress = {
        productId: lineItem.productId,
        optionValueIds: this.resolveOptionValueIds(lineItem),
        deductedQty: lineItem.quantity,
      };

      payload.completedLineItems = [
        ...(payload.completedLineItems ?? []),
        progress,
      ];

      await job.$query().patch({ payload });
    }

    await job.$query().patch({
      status: InventorySyncJobStatus.COMPLETED,
      errorCode: null,
      payload,
    });
  }

  private resolveOptionValueIds(
    lineItem: OrderLineItemDto,
  ): number[] | undefined {
    if (lineItem.optionValueIds?.length) {
      return lineItem.optionValueIds;
    }

    if (lineItem.optionValueId !== undefined) {
      return [lineItem.optionValueId];
    }

    return undefined;
  }

  private resolveStockOptionValueId(
    lineItem: OrderLineItemDto,
  ): number | undefined {
    return this.resolveOptionValueIds(lineItem)?.[0];
  }

  private isLineItemCompleted(
    completed: SyncJobLineItemProgress[],
    lineItem: OrderLineItemDto,
  ): boolean {
    const optionIds = this.resolveOptionValueIds(lineItem);

    return completed.some(
      (item) =>
        item.productId === lineItem.productId &&
        JSON.stringify(item.optionValueIds ?? []) ===
          JSON.stringify(optionIds ?? []),
    );
  }
}
