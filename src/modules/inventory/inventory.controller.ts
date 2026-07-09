import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LowStockAlertDto } from '../../integrations/opencart/opencart.types';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { GetInventoryQueryDto } from './dto/get-inventory-query.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { InventoryService } from './inventory.service';
import { InventoryItemDto } from './inventory.types';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('alerts')
  @ApiOperation({ summary: 'List products below the low-stock threshold' })
  @ApiResponse({ status: 200, description: 'Low-stock alert rows' })
  getAlerts(): Promise<LowStockAlertDto[]> {
    return this.inventoryService.getAlerts();
  }

  @Get()
  @ApiOperation({ summary: 'List inventory levels with low-stock flags' })
  list(@Query() query: ListInventoryQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get stock level for a product or variant' })
  @ApiResponse({
    status: 200,
    description: 'Stock detail with isLowStock flag',
  })
  findOne(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() query: GetInventoryQueryDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.findOne(productId, query.optionValueId);
  }

  @Patch(':productId')
  @ApiOperation({ summary: 'Manually adjust stock by a delta' })
  @ApiResponse({ status: 200, description: 'Updated stock after adjustment' })
  adjust(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: AdjustInventoryDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.adjust(productId, dto);
  }
}
