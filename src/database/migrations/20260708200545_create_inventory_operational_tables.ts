import { Knex } from 'knex';

const UPDATED_AT_TRIGGER = (table: string) => `
  CREATE TRIGGER ${table}_updated_at
  BEFORE UPDATE ON ${table}
  FOR EACH ROW EXECUTE FUNCTION on_update_timestamp();
`;

const DROP_UPDATED_AT_TRIGGER = (table: string) =>
  `DROP TRIGGER IF EXISTS ${table}_updated_at ON ${table};`;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('inventory_sync_jobs', (table) => {
    table.increments('id').primary();
    table.integer('order_id').notNullable().unique();
    table.string('status', 32).notNullable().defaultTo('pending');
    table.integer('attempts').notNullable().defaultTo(0);
    table.string('error_code', 64).nullable();
    table.jsonb('payload').nullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index('status');
  });

  await knex.schema.createTable('inventory_audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('order_id').nullable();
    table.integer('product_id').notNullable();
    table.jsonb('option_value_ids').nullable();
    table.integer('qty_before').notNullable();
    table.integer('qty_after').notNullable();
    table.string('source', 32).notNullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index('order_id');
    table.index('product_id');
  });

  await knex.schema.createTable('inventory_thresholds', (table) => {
    table.increments('id').primary();
    table.integer('product_id').notNullable().unique();
    table.integer('threshold').notNullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.raw(UPDATED_AT_TRIGGER('inventory_sync_jobs'));
  await knex.raw(UPDATED_AT_TRIGGER('inventory_audit_logs'));
  await knex.raw(UPDATED_AT_TRIGGER('inventory_thresholds'));
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(DROP_UPDATED_AT_TRIGGER('inventory_thresholds'));
  await knex.raw(DROP_UPDATED_AT_TRIGGER('inventory_audit_logs'));
  await knex.raw(DROP_UPDATED_AT_TRIGGER('inventory_sync_jobs'));

  await knex.schema.dropTableIfExists('inventory_thresholds');
  await knex.schema.dropTableIfExists('inventory_audit_logs');
  await knex.schema.dropTableIfExists('inventory_sync_jobs');
}
