// src/core/base.model.ts
import { Model, snakeCaseMappers } from 'objection';

export class BaseModel extends Model {
  id!: number;
  createdAt!: string;
  updatedAt!: string;

  static get columnNameMappers() {
    return snakeCaseMappers();
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    };
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString();
  }
}
