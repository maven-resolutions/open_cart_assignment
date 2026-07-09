import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { OpenCartModule } from './integrations/opencart/opencart.module';
import { InventorySyncProcessor } from './modules/inventory/inventory-sync.processor';
import { InventorySyncService } from './modules/inventory/inventory-sync.service';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    OpenCartModule,
    QueuesModule,
  ],
  providers: [InventorySyncService, InventorySyncProcessor],
})
export class WorkerModule {}
