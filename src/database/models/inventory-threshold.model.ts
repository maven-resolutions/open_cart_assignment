import { BaseModel } from '../base.model';

export class InventoryThreshold extends BaseModel {
  static tableName = 'inventory_thresholds';

  productId!: number;
  threshold!: number;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['productId', 'threshold'],
      properties: {
        id: { type: 'integer' },
        productId: { type: 'integer' },
        threshold: { type: 'integer', minimum: 0 },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    };
  }
}
