import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

const FREE_BOTTLE_LIMIT = 10

export default class HealthController {
  async handle({ response }: HttpContext) {
    let database: 'up' | 'down' = 'down'

    try {
      await db.rawQuery('SELECT 1')
      database = 'up'
    } catch {
      database = 'down'
    }

    return response.status(database === 'up' ? 200 : 503).json({
      app: 'atasoif-api',
      version: '0.2.0',
      freeBottleLimit: FREE_BOTTLE_LIMIT,
      database,
      status: database === 'up' ? 'ok' : 'degraded',
    })
  }
}
