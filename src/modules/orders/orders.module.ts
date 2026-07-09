import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OpenCartModule } from '../../integrations/opencart/opencart.module';
import { INVENTORY_SYNC_PRODUCER } from '../../queues/inventory-sync-producer.interface';
import { NoOpInventorySyncProducer } from '../../queues/noop-inventory-sync.producer';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [OpenCartModule, DatabaseModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    {
      provide: INVENTORY_SYNC_PRODUCER,
      useClass: NoOpInventorySyncProducer,
    },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
