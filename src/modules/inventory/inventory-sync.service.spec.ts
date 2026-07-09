import { Test, TestingModule } from '@nestjs/testing';
import { InventoryAuditLog } from '../../database/models/inventory-audit-log.model';
import { InventorySyncJob } from '../../database/models/inventory-sync-job.model';
import {
  InventoryAuditSource,
  InventorySyncJobStatus,
} from '../../database/models/inventory.types';
import { OpenCartClient } from '../../integrations/opencart/opencart.client';
import {
  INSUFFICIENT_STOCK_ERROR,
  OrderDto,
  OrderLineItemDto,
} from '../../integrations/opencart/opencart.types';
import { OrderStatusE } from '../../common/enums/order-status.enum';
import { InventorySyncInsufficientStockError } from './inventory-sync.errors';
import { InventorySyncService } from './inventory-sync.service';

function buildLineItem(
  overrides: Partial<OrderLineItemDto> = {},
): OrderLineItemDto {
  return {
    orderProductId: 101,
    productId: 15,
    name: 'Apple Cinema 30"',
    quantity: 2,
    price: 74.995,
    ...overrides,
  };
}

function buildOrder(overrides: Partial<OrderDto> = {}): OrderDto {
  return {
    id: 42,
    status: OrderStatusE.PROCESSING,
    orderStatusId: 2,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    total: 149.99,
    dateAdded: '2026-07-01T10:00:00Z',
    lineItems: [buildLineItem()],
    ...overrides,
  };
}

function buildSyncJob(overrides: Record<string, unknown> = {}) {
  const jobPatch = jest.fn().mockResolvedValue(undefined);

  return {
    job: {
      orderId: 42,
      status: InventorySyncJobStatus.PENDING,
      attempts: 0,
      payload: { completedLineItems: [] },
      $query: jest.fn().mockReturnValue({ patch: jobPatch }),
      ...overrides,
    },
    jobPatch,
  };
}

describe('InventorySyncService — processOrder deduct regression', () => {
  let service: InventorySyncService;
  let openCartClient: {
    getOrder: jest.Mock;
    getStock: jest.Mock;
    updateStock: jest.Mock;
  };
  let syncJobFindOne: jest.Mock;
  let auditLogInsert: jest.Mock;

  beforeEach(async () => {
    openCartClient = {
      getOrder: jest.fn(),
      getStock: jest.fn(),
      updateStock: jest.fn().mockResolvedValue({ productId: 15, quantity: 8 }),
    };
    syncJobFindOne = jest.fn();
    auditLogInsert = jest.fn().mockResolvedValue({ id: 1 });

    const syncJobModel = {
      query: jest.fn().mockReturnValue({
        findOne: syncJobFindOne,
      }),
    };

    const auditLogModel = {
      query: jest.fn().mockReturnValue({
        insert: auditLogInsert,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventorySyncService,
        { provide: OpenCartClient, useValue: openCartClient },
        { provide: InventorySyncJob, useValue: syncJobModel },
        { provide: InventoryAuditLog, useValue: auditLogModel },
      ],
    }).compile();

    service = module.get(InventorySyncService);
  });

  it('deducts stock when quantity is sufficient', async () => {
    const { job, jobPatch } = buildSyncJob();
    syncJobFindOne.mockResolvedValue(job);
    openCartClient.getOrder.mockResolvedValue(buildOrder());
    openCartClient.getStock.mockResolvedValue({ productId: 15, quantity: 10 });

    await service.processOrder(42);

    expect(openCartClient.getStock).toHaveBeenCalledWith(15, undefined);
    expect(openCartClient.updateStock).toHaveBeenCalledWith(15, 8, undefined);
    expect(auditLogInsert).toHaveBeenCalledWith({
      orderId: 42,
      productId: 15,
      optionValueIds: undefined,
      qtyBefore: 10,
      qtyAfter: 8,
      source: InventoryAuditSource.ORDER_SYNC,
    });
    expect(jobPatch).toHaveBeenCalledWith({
      status: InventorySyncJobStatus.PROCESSING,
      attempts: 1,
    });
    expect(jobPatch).toHaveBeenCalledWith({
      payload: {
        completedLineItems: [
          {
            productId: 15,
            optionValueIds: undefined,
            deductedQty: 2,
          },
        ],
      },
    });
    expect(jobPatch).toHaveBeenCalledWith({
      status: InventorySyncJobStatus.COMPLETED,
      errorCode: null,
      payload: {
        completedLineItems: [
          {
            productId: 15,
            optionValueIds: undefined,
            deductedQty: 2,
          },
        ],
      },
    });
  });

  it('does not deduct stock and marks the job failed when quantity is insufficient', async () => {
    const { job, jobPatch } = buildSyncJob();
    syncJobFindOne.mockResolvedValue(job);
    openCartClient.getOrder.mockResolvedValue(buildOrder());
    openCartClient.getStock.mockResolvedValue({ productId: 15, quantity: 1 });

    await expect(service.processOrder(42)).rejects.toThrow(
      InventorySyncInsufficientStockError,
    );

    expect(openCartClient.updateStock).not.toHaveBeenCalled();
    expect(auditLogInsert).not.toHaveBeenCalled();
    expect(jobPatch).toHaveBeenCalledWith({
      status: InventorySyncJobStatus.FAILED,
      errorCode: INSUFFICIENT_STOCK_ERROR,
    });
    expect(jobPatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: InventorySyncJobStatus.COMPLETED,
      }),
    );
  });

  it('uses option-level stock keys for variant line items', async () => {
    const { job, jobPatch } = buildSyncJob();
    syncJobFindOne.mockResolvedValue(job);
    openCartClient.getOrder.mockResolvedValue(
      buildOrder({
        lineItems: [
          buildLineItem({
            productId: 22,
            quantity: 1,
            optionValueIds: [77, 88],
          }),
        ],
      }),
    );
    openCartClient.getStock.mockResolvedValue({
      productId: 22,
      quantity: 5,
      optionValueId: 77,
    });
    openCartClient.updateStock.mockResolvedValue({
      productId: 22,
      quantity: 4,
      optionValueId: 77,
    });

    await service.processOrder(42);

    expect(openCartClient.getStock).toHaveBeenCalledWith(22, 77);
    expect(openCartClient.updateStock).toHaveBeenCalledWith(22, 4, 77);
    expect(auditLogInsert).toHaveBeenCalledWith({
      orderId: 42,
      productId: 22,
      optionValueIds: [77, 88],
      qtyBefore: 5,
      qtyAfter: 4,
      source: InventoryAuditSource.ORDER_SYNC,
    });
    expect(jobPatch).toHaveBeenCalledWith({
      status: InventorySyncJobStatus.COMPLETED,
      errorCode: null,
      payload: {
        completedLineItems: [
          {
            productId: 22,
            optionValueIds: [77, 88],
            deductedQty: 1,
          },
        ],
      },
    });
  });

  it('skips already completed sync jobs without stock side-effects', async () => {
    const { job } = buildSyncJob({
      status: InventorySyncJobStatus.COMPLETED,
      attempts: 1,
    });
    syncJobFindOne.mockResolvedValue(job);

    await service.processOrder(42);

    expect(openCartClient.getOrder).not.toHaveBeenCalled();
    expect(openCartClient.getStock).not.toHaveBeenCalled();
    expect(openCartClient.updateStock).not.toHaveBeenCalled();
    expect(auditLogInsert).not.toHaveBeenCalled();
  });
});
