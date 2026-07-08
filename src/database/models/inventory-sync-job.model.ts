import { BaseModel } from '../base.model';
import {
  InventorySyncJobStatus,
  SyncJobPayload,
} from './inventory.types';

export class InventorySyncJob extends BaseModel {
  static tableName = 'inventory_sync_jobs';

  orderId!: number;
  status!: InventorySyncJobStatus;
  attempts!: number;
  errorCode?: string | null;
  payload?: SyncJobPayload | null;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['orderId', 'status', 'attempts'],
      properties: {
        id: { type: 'integer' },
        orderId: { type: 'integer' },
        status: {
          type: 'string',
          enum: Object.values(InventorySyncJobStatus),
        },
        attempts: { type: 'integer', minimum: 0 },
        errorCode: { type: ['string', 'null'], maxLength: 64 },
        payload: { type: ['object', 'null'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    };
  }
}
