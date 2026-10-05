import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Tables expected by `@boringnode/queue` / `@adonisjs/queue` Knex adapter.
 * Written as Lucid schema (not QueueSchemaService) so `ace build` resolves
 * without a direct `@boringnode/queue` TypeScript import in Docker.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('queue_jobs', (table) => {
      table.string('id', 255).notNullable()
      table.string('queue', 255).notNullable()
      table.enu('status', ['pending', 'active', 'delayed', 'completed', 'failed']).notNullable()
      table.text('data').notNullable()
      table.bigInteger('score').unsigned().nullable()
      table.string('worker_id', 255).nullable()
      table.bigInteger('acquired_at').unsigned().nullable()
      table.bigInteger('execute_at').unsigned().nullable()
      table.bigInteger('finished_at').unsigned().nullable()
      table.text('error').nullable()
      table.primary(['id', 'queue'])
      table.index(['queue', 'status', 'score'])
      table.index(['queue', 'status', 'execute_at'])
      table.index(['queue', 'status', 'finished_at'])
    })

    this.schema.createTable('queue_schedules', (table) => {
      table.string('id', 255).primary()
      table.string('status', 50).notNullable().defaultTo('active')
      table.string('name', 255).notNullable()
      table.text('payload').notNullable()
      table.string('cron_expression', 255).nullable()
      table.bigInteger('every_ms').unsigned().nullable()
      table.string('timezone', 100).notNullable().defaultTo('UTC')
      table.timestamp('from_date').nullable()
      table.timestamp('to_date').nullable()
      table.integer('run_limit').unsigned().nullable()
      table.integer('run_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('next_run_at').nullable()
      table.timestamp('last_run_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.index(['status', 'next_run_at'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('queue_schedules')
    this.schema.dropTableIfExists('queue_jobs')
  }
}
