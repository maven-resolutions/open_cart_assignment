import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OpenCartModule } from '../../integrations/opencart/opencart.module';
import { QueuesModule } from '../../queues/queues.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [OpenCartModule, DatabaseModule, QueuesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
