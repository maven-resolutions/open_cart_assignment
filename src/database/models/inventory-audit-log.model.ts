import { BaseModel } from '../base.model';
import { InventoryAuditSource } from './inventory.types';

export class InventoryAuditLog extends BaseModel {
  static tableName = 'inventory_audit_logs';

  orderId?: number | null;
  productId!: number;
  optionValueIds?: number[] | null;
  qtyBefore!: number;
  qtyAfter!: number;
  source!: InventoryAuditSource;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['productId', 'qtyBefore', 'qtyAfter', 'source'],
      properties: {
        id: { type: 'integer' },
        orderId: { type: ['integer', 'null'] },
        productId: { type: 'integer' },
        optionValueIds: {
          type: ['array', 'null'],
          items: { type: 'integer' },
        },
        qtyBefore: { type: 'integer' },
        qtyAfter: { type: 'integer' },
        source: {
          type: 'string',
          enum: Object.values(InventoryAuditSource),
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    };
  }
}
