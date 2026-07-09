import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { OrderStatusE } from '../../common/enums/order-status.enum';
import { InventorySyncJob } from '../../database/models/inventory-sync-job.model';
import { InventorySyncJobStatus } from '../../database/models/inventory.types';
import { OpenCartClient } from '../../integrations/opencart/opencart.client';
import { OrderDto } from '../../integrations/opencart/opencart.types';
import { INVENTORY_SYNC_PRODUCER } from '../../queues/inventory-sync-producer.interface';
import type { InventorySyncProducer } from '../../queues/inventory-sync-producer.interface';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

function buildOrder(overrides: Partial<OrderDto> = {}): OrderDto {
  return {
    id: 42,
    status: OrderStatusE.PENDING,
    orderStatusId: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    total: 149.99,
    dateAdded: '2026-07-01T10:00:00Z',
    lineItems: [
      {
        orderProductId: 101,
        productId: 15,
        name: 'Apple Cinema 30"',
        quantity: 2,
        price: 74.995,
      },
    ],
    ...overrides,
  };
}

async function validateUpdateOrderStatusDto(plain: Record<string, unknown>) {
  const instance = Object.assign(new UpdateOrderStatusDto(), plain);
  return validate(instance);
}

describe('UpdateOrderStatusDto', () => {
  it('accepts a valid processing status', async () => {
    const errors = await validateUpdateOrderStatusDto({
      status: OrderStatusE.PROCESSING,
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional comment', async () => {
    const errors = await validateUpdateOrderStatusDto({
      status: OrderStatusE.SHIPPED,
      comment: 'Packed and dispatched',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects missing status', async () => {
    const errors = await validateUpdateOrderStatusDto({});
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('rejects an invalid status value', async () => {
    const errors = await validateUpdateOrderStatusDto({ status: 'in_transit' });
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('rejects a comment longer than 500 characters', async () => {
    const errors = await validateUpdateOrderStatusDto({
      status: OrderStatusE.PROCESSING,
      comment: 'x'.repeat(501),
    });
    expect(errors.some((error) => error.property === 'comment')).toBe(true);
  });
});

describe('OrdersService — updateStatus enqueue regression', () => {
  let service: OrdersService;
  let openCartClient: {
    getOrder: jest.Mock;
    updateOrderStatus: jest.Mock;
  };
  let inventorySyncProducer: { enqueue: jest.Mock };
  let syncJobFindOne: jest.Mock;
  let syncJobInsert: jest.Mock;

  beforeEach(async () => {
    openCartClient = {
      getOrder: jest.fn(),
      updateOrderStatus: jest.fn().mockResolvedValue(undefined),
    };
    inventorySyncProducer = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };
    syncJobFindOne = jest.fn().mockResolvedValue(null);
    syncJobInsert = jest.fn().mockResolvedValue({ id: 1 });

    const syncJobModel = {
      query: jest.fn().mockReturnValue({
        findOne: syncJobFindOne,
        insert: syncJobInsert,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OpenCartClient, useValue: openCartClient },
        { provide: InventorySyncJob, useValue: syncJobModel },
        {
          provide: INVENTORY_SYNC_PRODUCER,
          useValue: inventorySyncProducer as InventorySyncProducer,
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('enqueues inventory sync when status transitions to processing', async () => {
    const pendingOrder = buildOrder({ status: OrderStatusE.PENDING });
    const processingOrder = buildOrder({ status: OrderStatusE.PROCESSING });
    openCartClient.getOrder
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce(processingOrder);

    const result = await service.updateStatus(42, {
      status: OrderStatusE.PROCESSING,
      comment: 'Order moved to processing',
    });

    expect(openCartClient.updateOrderStatus).toHaveBeenCalledWith(
      42,
      OrderStatusE.PROCESSING,
      'Order moved to processing',
    );
    expect(syncJobInsert).toHaveBeenCalledWith({
      orderId: 42,
      status: InventorySyncJobStatus.PENDING,
      attempts: 0,
    });
    expect(inventorySyncProducer.enqueue).toHaveBeenCalledWith(42);
    expect(result).toEqual(processingOrder);
  });

  it('does not enqueue when transitioning processing to shipped', async () => {
    const processingOrder = buildOrder({ status: OrderStatusE.PROCESSING });
    const shippedOrder = buildOrder({ status: OrderStatusE.SHIPPED });
    openCartClient.getOrder
      .mockResolvedValueOnce(processingOrder)
      .mockResolvedValueOnce(shippedOrder);

    const result = await service.updateStatus(42, {
      status: OrderStatusE.SHIPPED,
    });

    expect(openCartClient.updateOrderStatus).toHaveBeenCalledWith(
      42,
      OrderStatusE.SHIPPED,
      undefined,
    );
    expect(syncJobInsert).not.toHaveBeenCalled();
    expect(inventorySyncProducer.enqueue).not.toHaveBeenCalled();
    expect(result).toEqual(shippedOrder);
  });

  it('rejects invalid status transitions without enqueue side-effects', async () => {
    const shippedOrder = buildOrder({ status: OrderStatusE.SHIPPED });
    openCartClient.getOrder.mockResolvedValue(shippedOrder);

    await expect(
      service.updateStatus(42, { status: OrderStatusE.PENDING }),
    ).rejects.toThrow(BadRequestException);

    expect(openCartClient.updateOrderStatus).not.toHaveBeenCalled();
    expect(syncJobInsert).not.toHaveBeenCalled();
    expect(inventorySyncProducer.enqueue).not.toHaveBeenCalled();
  });

  it('returns current order without upstream update when status is unchanged', async () => {
    const pendingOrder = buildOrder({ status: OrderStatusE.PENDING });
    openCartClient.getOrder.mockResolvedValue(pendingOrder);

    const result = await service.updateStatus(42, {
      status: OrderStatusE.PENDING,
    });

    expect(result).toEqual(pendingOrder);
    expect(openCartClient.updateOrderStatus).not.toHaveBeenCalled();
    expect(syncJobInsert).not.toHaveBeenCalled();
    expect(inventorySyncProducer.enqueue).not.toHaveBeenCalled();
  });

  it('skips sync job insert when a pending job already exists', async () => {
    const pendingOrder = buildOrder({ status: OrderStatusE.PENDING });
    const processingOrder = buildOrder({ status: OrderStatusE.PROCESSING });
    openCartClient.getOrder
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce(processingOrder);
    syncJobFindOne.mockResolvedValue({
      id: 7,
      orderId: 42,
      status: InventorySyncJobStatus.PENDING,
      attempts: 1,
    });

    await service.updateStatus(42, { status: OrderStatusE.PROCESSING });

    expect(syncJobInsert).not.toHaveBeenCalled();
    expect(inventorySyncProducer.enqueue).toHaveBeenCalledWith(42);
  });
});
