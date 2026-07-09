import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OpenCartModule } from '../../integrations/opencart/opencart.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [OpenCartModule, DatabaseModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
