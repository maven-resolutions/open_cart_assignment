import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatusE } from '../../common/enums/order-status.enum';
import { InventorySyncJob } from '../../database/models/inventory-sync-job.model';
import { InventorySyncJobStatus } from '../../database/models/inventory.types';
import { OpenCartClient } from '../../integrations/opencart/opencart.client';
import {
  OpenCartApiError,
  OrderDto,
  PaginatedResult,
} from '../../integrations/opencart/opencart.types';
import { INVENTORY_SYNC_PRODUCER } from '../../queues/inventory-sync-producer.interface';
import type { InventorySyncProducer } from '../../queues/inventory-sync-producer.interface';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { isValidOrderStatusTransition } from './order-status.transitions';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly openCartClient: OpenCartClient,
    @Inject(InventorySyncJob)
    private readonly syncJobModel: typeof InventorySyncJob,
    @Inject(INVENTORY_SYNC_PRODUCER)
    private readonly inventorySyncProducer: InventorySyncProducer,
  ) {}

  async findAll(
    query: ListOrdersQueryDto,
  ): Promise<PaginatedResult<OrderDto>> {
    try {
      return await this.openCartClient.listOrders({
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      });
    } catch (error) {
      this.handleOpenCartError(error);
    }
  }

  async findOne(orderId: number): Promise<OrderDto> {
    try {
      return await this.openCartClient.getOrder(orderId);
    } catch (error) {
      this.handleOpenCartError(error, 'Order not found');
    }
  }

  async updateStatus(
    orderId: number,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderDto> {
    let order: OrderDto;

    try {
      order = await this.openCartClient.getOrder(orderId);
    } catch (error) {
      this.handleOpenCartError(error, 'Order not found');
    }

    const currentStatus = order.status as OrderStatusE;
    const nextStatus = dto.status;

    if (!isValidOrderStatusTransition(currentStatus, nextStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${nextStatus}`,
      );
    }

    if (currentStatus === nextStatus) {
      return order;
    }

    try {
      await this.openCartClient.updateOrderStatus(
        orderId,
        nextStatus,
        dto.comment,
      );
    } catch (error) {
      this.handleOpenCartError(error, 'Order not found');
    }

    if (nextStatus === OrderStatusE.PROCESSING) {
      await this.createSyncJobIfNeeded(orderId);
      void this.inventorySyncProducer.enqueue(orderId).catch((error) => {
        this.logger.error('Failed to enqueue inventory sync job', {
          orderId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    try {
      return await this.openCartClient.getOrder(orderId);
    } catch (error) {
      this.handleOpenCartError(error, 'Order not found');
    }
  }

  private async createSyncJobIfNeeded(orderId: number): Promise<void> {
    const existing = await this.syncJobModel.query().findOne({ orderId });

    if (existing?.status === InventorySyncJobStatus.COMPLETED) {
      return;
    }

    if (existing) {
      return;
    }

    await this.syncJobModel.query().insert({
      orderId,
      status: InventorySyncJobStatus.PENDING,
      attempts: 0,
    });
  }

  private handleOpenCartError(error: unknown, notFoundMessage?: string): never {
    if (error instanceof OpenCartApiError) {
      if (notFoundMessage && this.isNotFoundError(error)) {
        throw new NotFoundException(notFoundMessage);
      }
      throw new BadGatewayException(this.formatUpstreamMessage(error));
    }

    throw error;
  }

  private isNotFoundError(error: OpenCartApiError): boolean {
    const message = error.message.toLowerCase();
    if (
      message.includes('not found') ||
      message.includes('invalid order') ||
      message.includes('unknown order')
    ) {
      return true;
    }

    return error.statusCode === 404;
  }

  private formatUpstreamMessage(error: OpenCartApiError): string {
    if (error.statusCode === 404) {
      return (
        'OpenCart order API route not found — verify OPENCART_BASE_URL is correct ' +
        'and the api/order/* routes are available'
      );
    }

    return error.message;
  }
}
