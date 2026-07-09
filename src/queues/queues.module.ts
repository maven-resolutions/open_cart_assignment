import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { INVENTORY_SYNC_PRODUCER } from './inventory-sync-producer.interface';
import { InventorySyncQueueProducer } from './inventory-sync.producer';
import { INVENTORY_SYNC_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host') ?? 'redis',
          port: configService.get<number>('redis.port') ?? 6379,
        },
        prefix: configService.get<string>('bullmq.prefix') ?? 'unisouk',
      }),
    }),
    BullModule.registerQueue({
      name: INVENTORY_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],
  providers: [
    InventorySyncQueueProducer,
    {
      provide: INVENTORY_SYNC_PRODUCER,
      useExisting: InventorySyncQueueProducer,
    },
  ],
  exports: [BullModule, INVENTORY_SYNC_PRODUCER],
})
export class QueuesModule {}
