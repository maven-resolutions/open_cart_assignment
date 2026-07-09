import { InventorySyncQueueProducer } from './inventory-sync.producer';
import { INVENTORY_SYNC_JOB_NAME } from './queue.constants';

describe('InventorySyncQueueProducer', () => {
  it('enqueues a job with dedup jobId and order payload', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'sync-order-42' });
    const producer = new InventorySyncQueueProducer({ add } as never);

    await producer.enqueue(42);

    expect(add).toHaveBeenCalledWith(
      INVENTORY_SYNC_JOB_NAME,
      { orderId: 42 },
      { jobId: 'sync-order-42' },
    );
  });
});
