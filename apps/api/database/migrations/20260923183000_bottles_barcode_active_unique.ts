import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One active catalog row per barcode. Duplicate misses and racing barcode
 * lookups used to insert a second bottle; lookup then returned an arbitrary row.
 * Extra copies keep the oldest id and lose the duplicate barcode.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      WITH ranked AS (
        SELECT id,
               row_number() OVER (PARTITION BY barcode ORDER BY id) AS rn
        FROM bottles
        WHERE deleted_at IS NULL
          AND barcode IS NOT NULL
          AND btrim(barcode) <> ''
      )
      UPDATE bottles
      SET barcode = NULL
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `)

    this.schema.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS bottles_barcode_active_unique
      ON bottles (barcode)
      WHERE deleted_at IS NULL AND barcode IS NOT NULL
    `)
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS bottles_barcode_active_unique')
  }
}
