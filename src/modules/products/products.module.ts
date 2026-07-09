import { Module } from '@nestjs/common';
import { OpenCartModule } from '../../integrations/opencart/opencart.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [OpenCartModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
