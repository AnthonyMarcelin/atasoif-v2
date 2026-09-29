import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { FILL_LEVEL_FINISHED, FREE_BOTTLE_LIMIT } from '@atasoif/shared'

/**
 * Read-only ops KPIs for the Habitudes page, the cellar stages of the
 * conversion funnel, and the Vue d'ensemble bottle counters.
 * Contract: docs/conception/ops/kpi-api.md
 *
 * Mockup product readings (retention cliff at 4 bottles, social lift, annual
 * vs monthly churn) are not metrics here. See that contract.
 */

export const OPS_STUB_REASONS = {
  noSessionAnalytics: 'no_session_analytics',
  billingNotImplemented: 'billing_not_implemented',
  paywallEventsNotTracked: 'paywall_events_not_tracked',
  cohortWindowNotImplemented: 'cohort_window_not_implemented',
  noOpenOrFinishedTimestamp: 'no_open_or_finished_timestamp',
  sameBottleRowUnique: 'same_bottle_row_unique',
} as const

const THREE_BOTTLE_THRESHOLD = 3
const TOP_LIMIT = 10

const PRICE_BUCKETS = [
  { id: 'under_10', label: '0-10', column: 'under_10', min: 0, max: 10 },
  { id: 'from_10_to_25', label: '10-25', column: 'from_10_to_25', min: 10, max: 25 },
  { id: 'from_25_to_50', label: '25-50', column: 'from_25_to_50', min: 25, max: 50 },
  { id: 'from_50_to_80', label: '50-80', column: 'from_50_to_80', min: 50, max: 80 },
  { id: 'from_80_to_150', label: '80-150', column: 'from_80_to_150', min: 80, max: 150 },
  { id: 'from_150', label: '150+', column: 'from_150', min: 150, max: null },
] as const

type LiveValue = {
  status: 'live'
  label: string
  value: number
}

type StubValue = {
  status: 'stub'
  label: string
  value: null
  reasonCode: string
}

type PopulationRow = {
  users: number | string
  bottles: number | string
  mean_cnt: number | string | null
  median_cnt: number | string | null
  first_bottle: number | string
  three_bottles: number | string
  cellar_full: number | string
}

type HabitsRow = {
  total: number | string
  finished: number | string
  with_review: number | string
  avg_price: number | string | null
  median_price: number | string | null
  priced: number | string
  avg_note: number | string | null
  noted: number | string
  avg_level_updates: number | string | null
  level_updates_total: number | string
}

type BucketRow = Record<(typeof PRICE_BUCKETS)[number]['column'], number | string>

type TopRow = {
  bottle_id: number | string
  name: string
  cellars: number | string
  avg_price: number | string | null
  avg_note: number | string | null
}

type PlaceRow = {
  place: string
  count: number | string
  declared_count: number | string
}

function asNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asNumberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function percentOf(part: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return round((part / total) * 100, 1)
}

function oneRow<T>(rows: T[], queryName: string): T {
  const row = rows[0]
  if (!row) {
    throw new Error(`Ops KPI query returned no row: ${queryName}`)
  }
  return row
}

function stub(label: string, reasonCode: string): StubValue {
  return { status: 'stub', label, value: null, reasonCode }
}

export default class OpsKpiService {
  async collect() {
    const dayStart = DateTime.utc().startOf('day').toISO()
    if (!dayStart) {
      throw new Error('Unable to resolve the UTC day start for ops KPIs')
    }

    const populationResult = await db.rawQuery(
      `
          WITH sizes AS (
            SELECT u.id, COUNT(ub.id)::int AS cnt
            FROM users u
            LEFT JOIN user_bottles ub ON ub.user_id = u.id
            GROUP BY u.id
          )
          SELECT
            COUNT(*)::int AS users,
            COALESCE(SUM(cnt), 0)::int AS bottles,
            AVG(cnt) AS mean_cnt,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY cnt) AS median_cnt,
            COUNT(*) FILTER (WHERE cnt >= 1)::int AS first_bottle,
            COUNT(*) FILTER (WHERE cnt >= ?::int)::int AS three_bottles,
            COUNT(*) FILTER (WHERE cnt >= ?::int)::int AS cellar_full
          FROM sizes
          `,
      [THREE_BOTTLE_THRESHOLD, FREE_BOTTLE_LIMIT]
    )
    const todayResult = await db.rawQuery(
      `
          SELECT COUNT(*)::int AS bottles_today
          FROM user_bottles
          WHERE created_at >= ?::timestamptz
          `,
      [dayStart]
    )
    const habitsResult = await db.rawQuery(
      `
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE fill_level = ?::int)::int AS finished,
            COUNT(*) FILTER (
              WHERE review IS NOT NULL AND btrim(review) <> ''
            )::int AS with_review,
            AVG(price_paid) AS avg_price,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY price_paid) AS median_price,
            COUNT(price_paid)::int AS priced,
            AVG(note) AS avg_note,
            COUNT(note)::int AS noted,
            AVG(fill_level_updates_count) AS avg_level_updates,
            COALESCE(SUM(fill_level_updates_count), 0)::int AS level_updates_total
          FROM user_bottles
          `,
      [FILL_LEVEL_FINISHED]
    )
    const bucketResult = await db.rawQuery(
      `
          SELECT
            COUNT(*) FILTER (WHERE price_paid < 10)::int AS under_10,
            COUNT(*) FILTER (WHERE price_paid >= 10 AND price_paid < 25)::int AS from_10_to_25,
            COUNT(*) FILTER (WHERE price_paid >= 25 AND price_paid < 50)::int AS from_25_to_50,
            COUNT(*) FILTER (WHERE price_paid >= 50 AND price_paid < 80)::int AS from_50_to_80,
            COUNT(*) FILTER (WHERE price_paid >= 80 AND price_paid < 150)::int AS from_80_to_150,
            COUNT(*) FILTER (WHERE price_paid >= 150)::int AS from_150
          FROM user_bottles
          `
    )
    const topResult = await db.rawQuery(
      `
          SELECT
            b.id AS bottle_id,
            b.name,
            COUNT(ub.id)::int AS cellars,
            AVG(ub.price_paid) AS avg_price,
            AVG(ub.note) AS avg_note
          FROM user_bottles ub
          INNER JOIN bottles b ON b.id = ub.bottle_id
          GROUP BY b.id, b.name
          ORDER BY COUNT(ub.id) DESC, b.name ASC
          LIMIT ?
          `,
      [TOP_LIMIT]
    )
    const placeResult = await db.rawQuery(
      `
          WITH places AS (
            SELECT btrim(bought_at) AS place, COUNT(*)::int AS count
            FROM user_bottles
            WHERE bought_at IS NOT NULL AND btrim(bought_at) <> ''
            GROUP BY btrim(bought_at)
          )
          SELECT place, count, (SUM(count) OVER ())::int AS declared_count
          FROM places
          ORDER BY count DESC, place ASC
          LIMIT ?
          `,
      [TOP_LIMIT]
    )

    const population = oneRow(populationResult.rows as PopulationRow[], 'population')
    const today = oneRow(todayResult.rows as { bottles_today: number | string }[], 'today')
    const habits = oneRow(habitsResult.rows as HabitsRow[], 'habits')
    const buckets = oneRow(bucketResult.rows as BucketRow[], 'prices')
    const topRows = topResult.rows as TopRow[]
    const placeRows = placeResult.rows as PlaceRow[]

    const users = asNumber(population.users)
    const bottles = asNumber(population.bottles)
    const accounts = users
    const firstBottle = asNumber(population.first_bottle)
    const threeBottles = asNumber(population.three_bottles)
    const cellarFull = asNumber(population.cellar_full)
    const finished = asNumber(habits.finished)
    const withReview = asNumber(habits.with_review)
    const priced = asNumber(habits.priced)
    const noted = asNumber(habits.noted)
    const meanPrice = asNumberOrNull(habits.avg_price)
    const medianPrice = asNumberOrNull(habits.median_price)
    const meanNote = asNumberOrNull(habits.avg_note)
    const meanLevelUpdates = asNumberOrNull(habits.avg_level_updates)
    const declaredCount = placeRows.length === 0 ? 0 : asNumber(placeRows[0].declared_count)

    const funnel = this.funnel(accounts, firstBottle, threeBottles, cellarFull)

    const generatedAt = DateTime.utc().toISO()
    if (!generatedAt) {
      throw new Error('Unable to format the ops KPI timestamp')
    }

    return {
      generatedAt,
      overview: {
        bottlesAddedToday: {
          status: 'live',
          label: 'Bouteilles ajoutées',
          value: asNumber(today.bottles_today),
        } satisfies LiveValue,
        bottlesTotal: {
          status: 'live',
          label: 'Bouteilles en cave',
          value: bottles,
        } satisfies LiveValue,
        bottlesPerUser: {
          status: 'live' as const,
          label: 'Bouteilles / user',
          mean: users === 0 ? 0 : round(asNumber(population.mean_cnt), 2),
          median: users === 0 ? 0 : round(asNumber(population.median_cnt), 2),
        },
        sessionsPerWeek: stub('Sessions / semaine', OPS_STUB_REASONS.noSessionAnalytics),
        revenue: stub('Revenus', OPS_STUB_REASONS.billingNotImplemented),
      },
      conversion: {
        window: { status: 'live' as const, id: 'all_time' as const },
        measuredAt30Days: stub('Mesuré à 30 jours', OPS_STUB_REASONS.cohortWindowNotImplemented),
        funnel,
        delayBeforeSubscription: stub(
          'Délai avant abonnement',
          OPS_STUB_REASONS.billingNotImplemented
        ),
        subscriptionTriggers: stub("Où ils s'abonnent", OPS_STUB_REASONS.paywallEventsNotTracked),
        planMix: stub('Choix de formule au paywall', OPS_STUB_REASONS.billingNotImplemented),
      },
      habitudes: {
        bottlesInCellar: {
          status: 'live' as const,
          label: 'Bouteilles en cave',
          value: asNumber(habits.total),
        },
        perUser: {
          status: 'live' as const,
          label: 'Par utilisateur',
          mean: users === 0 ? 0 : round(asNumber(population.mean_cnt), 2),
          median: users === 0 ? 0 : round(asNumber(population.median_cnt), 2),
        },
        averagePrice: {
          status: 'live' as const,
          label: 'Prix moyen noté',
          mean: meanPrice === null ? null : round(meanPrice, 2),
          median: medianPrice === null ? null : round(medianPrice, 2),
          sampleSize: priced,
        },
        averageNote: {
          status: 'live' as const,
          label: 'Note moyenne',
          value: meanNote === null ? null : round(meanNote, 1),
          sampleSize: noted,
        },
        withWrittenReview: {
          status: 'live' as const,
          label: 'Avec un mot écrit',
          count: withReview,
          percent: percentOf(withReview, bottles),
        },
        finished: {
          status: 'live' as const,
          label: 'Terminées',
          count: finished,
          percent: percentOf(finished, bottles),
        },
        topBottles: {
          status: 'live' as const,
          label: 'Top 10 des bouteilles',
          items: topRows.map((row) => {
            const price = asNumberOrNull(row.avg_price)
            const note = asNumberOrNull(row.avg_note)
            return {
              bottleId: asNumber(row.bottle_id),
              name: row.name,
              cellars: asNumber(row.cellars),
              averagePrice: price === null ? null : round(price, 2),
              averageNote: note === null ? null : round(note, 1),
            }
          }),
        },
        priceDistribution: {
          status: 'live' as const,
          label: 'Répartition des prix payés',
          pricedCount: priced,
          buckets: PRICE_BUCKETS.map((bucket) => {
            const count = asNumber(buckets[bucket.column])
            return {
              id: bucket.id,
              label: bucket.label,
              min: bucket.min,
              max: bucket.max,
              count,
              percent: percentOf(count, priced),
            }
          }),
        },
        priceByPlan: stub('Abonnés payants vs gratuits', OPS_STUB_REASONS.billingNotImplemented),
        purchasePlaces: {
          status: 'live' as const,
          label: "Lieux d'achat déclarés",
          declaredCount,
          items: placeRows.map((row) => {
            const count = asNumber(row.count)
            return {
              place: row.place,
              count,
              percent: percentOf(count, declaredCount),
            }
          }),
        },
        bottleLifetimeDays: stub(
          "Durée de vie d'une bouteille",
          OPS_STUB_REASONS.noOpenOrFinishedTimestamp
        ),
        levelUpdates: {
          status: 'live' as const,
          label: 'Mises à jour de niveau',
          meanPerBottle:
            bottles === 0 || meanLevelUpdates === null ? null : round(meanLevelUpdates, 2),
          total: asNumber(habits.level_updates_total),
        },
        repurchase: stub('Rachètent la même', OPS_STUB_REASONS.sameBottleRowUnique),
      },
    }
  }

  private funnel(accounts: number, firstBottle: number, threeBottles: number, cellarFull: number) {
    const stages: Array<Record<string, unknown>> = []
    let previous: number | null = null

    const pushLive = (id: string, label: string, count: number, threshold?: number) => {
      const lostFromPreviousPercent =
        previous !== null && previous > 0 ? round(((previous - count) / previous) * 100, 1) : null
      stages.push({
        id,
        status: 'live',
        label,
        count,
        percent: percentOf(count, accounts),
        lostFromPreviousPercent,
        ...(threshold === undefined ? {} : { threshold }),
      })
      previous = count
    }

    pushLive('account_created', 'Compte créé', accounts)
    pushLive('first_bottle', '1ʳᵉ bouteille ajoutée', firstBottle, 1)
    pushLive('three_bottles', '3 bouteilles', threeBottles, THREE_BOTTLE_THRESHOLD)
    pushLive('cellar_full', 'Cave pleine · 10/10', cellarFull, FREE_BOTTLE_LIMIT)

    stages.push({
      id: 'paywall_viewed',
      status: 'stub',
      label: 'Paywall consulté',
      count: null,
      percent: null,
      lostFromPreviousPercent: null,
      reasonCode: OPS_STUB_REASONS.paywallEventsNotTracked,
    })
    stages.push({
      id: 'subscription_paid',
      status: 'stub',
      label: 'Abonnement payé',
      count: null,
      percent: null,
      lostFromPreviousPercent: null,
      reasonCode: OPS_STUB_REASONS.billingNotImplemented,
    })

    return stages
  }
}
