import type { HttpContext } from '@adonisjs/core/http'
import OpsKpiService from '#services/ops/ops_kpi_service'

/**
 * Read-only ops KPIs. Contract: docs/conception/ops/kpi-api.md
 * GET /api/v1/ops/kpis
 */
export default class OpsKpisController {
  async index({ response }: HttpContext) {
    const payload = await new OpsKpiService().collect()
    return response.ok(payload)
  }
}
