import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ObjectionModule } from '@willsoto/nestjs-objection';
import { BaseModel } from './base.model';
import { createKnexConfig } from './database.config';
import {
  InventoryAuditLog,
  InventorySyncJob,
  InventoryThreshold,
} from './models';

@Module({
  imports: [
    ObjectionModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          Model: BaseModel,
          config: createKnexConfig(configService),
        };
      },
    }),
    ObjectionModule.forFeature([
      InventorySyncJob,
      InventoryAuditLog,
      InventoryThreshold,
    ]),
  ],
  exports: [ObjectionModule],
})
export class DatabaseModule {}
