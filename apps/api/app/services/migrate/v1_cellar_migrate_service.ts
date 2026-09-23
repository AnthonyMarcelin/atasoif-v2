import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DateTime } from 'luxon'
import { BOTTLE_SOURCES, FILL_LEVEL_DEFAULT } from '@atasoif/shared'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Bottle from '#models/bottle'
import BottleSource from '#models/bottle_source'
import Category from '#models/category'
import Subscription from '#models/subscription'
import User from '#models/user'
import UserBottle from '#models/user_bottle'

/** Stable marker — not a RevenueCat / IAP provider. */
export const LEGACY_V1_PROVIDER = 'legacy_v1'
export const LEGACY_V1_PLAN = 'legacy'

export type V1CategorySlug = 'whisky' | 'beer' | 'rhum'

export type V1UserExport = {
  id: number
  email: string
  pseudo: string
  firstname: string
  lastname: string
  is_admin: boolean
  is_verified: boolean
  created_at: string
  updated_at: string
  /** Argon2id PHC — loaded from Railway at migrate time, never from sanitized JSON. */
  password?: string
}

export type V1BottleExport = {
  id: number
  name: string
  description: string | null
  review: string | null
  note: number | null
  price: number | null
  photo: string | null
  origin_country?: string | null
  supplier_name?: string | null
  supplier_address?: string | null
  type_name?: string | null
  peat_level_name?: string | null
  label_name?: string | null
  label_color?: string | null
  user_id: number
  created_at: string
  updated_at: string
}

export type V1MigratePayload = {
  users: V1UserExport[]
  whisky: V1BottleExport[]
  beer: V1BottleExport[]
  rhum: V1BottleExport[]
}

export type V1MigrateSummary = {
  dryRun: boolean
  usersCreated: number
  usersSkippedDuplicateEmail: number
  usersExisting: number
  usersMissingPassword: number
  subscriptionsUpserted: number
  bottlesCreated: number
  bottlesReused: number
  userBottlesCreated: number
  userBottlesSkipped: number
}

type BottleKind = V1CategorySlug

function externalIdFor(kind: BottleKind, v1Id: number): string {
  return `v1:${kind}:${v1Id}`
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function fullName(user: V1UserExport): string {
  return `${user.firstname} ${user.lastname}`.trim()
}

export function mergeReview(
  description: string | null,
  review: string | null
): { review: string | null; descriptionAttr: string | null } {
  const desc = description?.trim() || null
  const rev = review?.trim() || null
  if (desc && rev && desc !== rev) {
    return { review: rev, descriptionAttr: desc }
  }
  return { review: rev ?? desc, descriptionAttr: null }
}

function boughtAtPlace(row: V1BottleExport): string {
  const name = row.supplier_name?.trim()
  const address = row.supplier_address?.trim()
  if (name && address) {
    return `${name} — ${address}`
  }
  if (name) {
    return name
  }
  return 'Inconnu'
}

function buildAttrs(kind: BottleKind, row: V1BottleExport, descriptionAttr: string | null) {
  const attrs: Record<string, unknown> = {
    v1: { table: kind, id: row.id },
  }
  if (row.type_name) {
    attrs.type = row.type_name
  }
  if (kind === 'whisky' && row.peat_level_name) {
    attrs.peatLevel = row.peat_level_name
  }
  if (row.label_name) {
    attrs.qualityLabel = row.label_name
  }
  if (row.label_color) {
    attrs.qualityColor = row.label_color
  }
  if (descriptionAttr) {
    attrs.description = descriptionAttr
  }
  return attrs
}

/**
 * Deduplicate v1 users by lower(email), keep lowest id (fixes v1 missing UNIQUE).
 */
export function dedupeV1Users(users: V1UserExport[]): {
  kept: V1UserExport[]
  skippedDuplicateIds: number[]
} {
  const byEmail = new Map<string, V1UserExport>()
  const skippedDuplicateIds: number[] = []
  const sorted = [...users].sort((a, b) => a.id - b.id)
  for (const user of sorted) {
    const key = normalizeEmail(user.email)
    if (byEmail.has(key)) {
      skippedDuplicateIds.push(user.id)
      continue
    }
    byEmail.set(key, user)
  }
  return { kept: [...byEmail.values()], skippedDuplicateIds }
}

export async function loadV1ExportDirectory(dir: string): Promise<V1MigratePayload> {
  const readJson = async <T>(name: string): Promise<T> => {
    const raw = await readFile(join(dir, name), 'utf8')
    return JSON.parse(raw) as T
  }
  return {
    users: await readJson<V1UserExport[]>('users.json'),
    whisky: await readJson<V1BottleExport[]>('whisky.json'),
    beer: await readJson<V1BottleExport[]>('beer.json'),
    rhum: await readJson<V1BottleExport[]>('rhum.json'),
  }
}

/**
 * Read password hashes from Railway v1 (read-only). Never log the URL or hashes.
 */
export async function fetchV1PasswordsByUserId(
  databaseUrl: string
): Promise<Map<number, string>> {
  const { default: pg } = await import('pg')
  const client = new pg.Client({
    connectionString: ensureSsl(databaseUrl),
    connectionTimeoutMillis: 15_000,
    // Railway public proxy presents a cert Node does not trust by default.
    // Read-only password fetch for one-shot migration — do not reuse for app traffic.
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    const result = await client.query<{ id: number; password: string }>(
      'SELECT id, password FROM "user"'
    )
    const map = new Map<number, string>()
    for (const row of result.rows) {
      map.set(row.id, row.password)
    }
    return map
  } finally {
    await client.end()
  }
}

function ensureSsl(url: string): string {
  // Prefer libpq-compat require semantics for Railway public URLs (pg v8+/v9 warning).
  if (url.includes('sslmode=') || url.includes('uselibpqcompat=')) {
    return url
  }
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}uselibpqcompat=true&sslmode=require`
}

export default class V1CellarMigrateService {
  async run(input: {
    payload: V1MigratePayload
    dryRun?: boolean
  }): Promise<V1MigrateSummary> {
    const dryRun = input.dryRun ?? false
    const summary: V1MigrateSummary = {
      dryRun,
      usersCreated: 0,
      usersSkippedDuplicateEmail: 0,
      usersExisting: 0,
      usersMissingPassword: 0,
      subscriptionsUpserted: 0,
      bottlesCreated: 0,
      bottlesReused: 0,
      userBottlesCreated: 0,
      userBottlesSkipped: 0,
    }

    const { kept, skippedDuplicateIds } = dedupeV1Users(input.payload.users)
    summary.usersSkippedDuplicateEmail = skippedDuplicateIds.length
    const keptIds = new Set(kept.map((u) => u.id))

    if (dryRun) {
      for (const user of kept) {
        if (!user.password?.startsWith('$argon2')) {
          summary.usersMissingPassword++
          continue
        }
        const existing = await User.findBy('email', normalizeEmail(user.email))
        if (existing) {
          summary.usersExisting++
        } else {
          summary.usersCreated++
        }
        summary.subscriptionsUpserted++
      }
      for (const { kind, row } of this.flattenBottles(input.payload)) {
        if (!keptIds.has(row.user_id)) {
          continue
        }
        const owner = kept.find((u) => u.id === row.user_id)
        if (!owner?.password?.startsWith('$argon2')) {
          continue
        }
        const source = await BottleSource.findBy({
          source: BOTTLE_SOURCES.user,
          externalId: externalIdFor(kind, row.id),
        })
        if (source) {
          summary.bottlesReused++
          const existingUb = await UserBottle.query().where('bottle_id', source.bottleId).first()
          if (existingUb) {
            summary.userBottlesSkipped++
          } else {
            summary.userBottlesCreated++
          }
        } else {
          summary.bottlesCreated++
          summary.userBottlesCreated++
        }
      }
      return summary
    }

    const categories = await this.loadCategories()
    const v1ToV2UserId = new Map<number, number>()

    await db.transaction(async (trx) => {
      for (const v1User of kept) {
        if (!v1User.password?.startsWith('$argon2')) {
          summary.usersMissingPassword++
          continue
        }

        const email = normalizeEmail(v1User.email)
        let user = await User.query({ client: trx }).where('email', email).first()

        if (user) {
          summary.usersExisting++
          user.useTransaction(trx)
          user.pseudo = await this.resolvePseudo(v1User.pseudo, user.id, trx)
          user.fullName = fullName(v1User)
          user.emailVerified = v1User.is_verified
          await user.save()
          // Prefer v1 argon hash so legacy login keeps working (bypass AuthFinder re-hash).
          await trx.from('users').where('id', user.id).update({ password: v1User.password })
        } else {
          const pseudo = await this.resolvePseudo(v1User.pseudo, null, trx)
          user = await User.create(
            {
              email,
              // Temporary — AuthFinder would re-hash; overwritten via query below.
              password: `migrate-placeholder-${v1User.id}`,
              fullName: fullName(v1User),
              pseudo,
              emailVerified: v1User.is_verified,
              isPublic: false,
              image: null,
              bottlesCreatedCount: 0,
              passwordResetVersion: 0,
            },
            { client: trx }
          )
          await trx.from('users').where('id', user.id).update({ password: v1User.password })
          summary.usersCreated++
        }

        v1ToV2UserId.set(v1User.id, user.id)

        await Subscription.updateOrCreate(
          { userId: user.id },
          {
            userId: user.id,
            plan: LEGACY_V1_PLAN,
            status: 'ACTIVE',
            provider: LEGACY_V1_PROVIDER,
            providerCustomerId: null,
            providerSubscriptionId: null,
            currentPeriodEnd: null,
          },
          { client: trx }
        )
        summary.subscriptionsUpserted++
      }

      const createdCounts = new Map<number, number>()

      for (const { kind, row } of this.flattenBottles(input.payload)) {
        const v2UserId = v1ToV2UserId.get(row.user_id)
        if (!v2UserId) {
          continue
        }

        const category = categories.get(kind)
        if (!category) {
          throw new Error(`Missing category slug "${kind}" — run category seeder first`)
        }

        const extId = externalIdFor(kind, row.id)
        const source = await BottleSource.query({ client: trx })
          .where('source', BOTTLE_SOURCES.user)
          .where('external_id', extId)
          .first()

        let bottleId: number
        if (source) {
          bottleId = source.bottleId
          summary.bottlesReused++
        } else {
          const { descriptionAttr } = mergeReview(row.description, row.review)
          const bottle = await Bottle.create(
            {
              name: row.name,
              brand: null,
              origin: row.origin_country?.trim() || null,
              abv: null,
              volumeMl: null,
              barcode: null,
              photoUrl: row.photo,
              photoStatus: row.photo ? 'pending' : null,
              attrs: buildAttrs(kind, row, descriptionAttr),
              categoryId: category.id,
              deletedAt: null,
            },
            { client: trx }
          )
          await BottleSource.create(
            {
              bottleId: bottle.id,
              source: BOTTLE_SOURCES.user,
              externalId: extId,
              rawHash: null,
              lastSyncedAt: DateTime.utc(),
            },
            { client: trx }
          )
          bottleId = bottle.id
          summary.bottlesCreated++
        }

        const existingUb = await UserBottle.query({ client: trx })
          .where('user_id', v2UserId)
          .where('bottle_id', bottleId)
          .first()
        if (existingUb) {
          summary.userBottlesSkipped++
          continue
        }

        const { review } = mergeReview(row.description, row.review)

        await UserBottle.create(
          {
            userId: v2UserId,
            bottleId,
            boughtAt: boughtAtPlace(row),
            pricePaid: row.price,
            note: row.note,
            review,
            fillLevel: FILL_LEVEL_DEFAULT,
            fillLevelUpdatesCount: 0,
            photoUrlOverride: row.photo,
            nameOverride: null,
            brandOverride: null,
            originOverride: null,
            abvOverride: null,
            volumeMlOverride: null,
            attrsOverride: null,
            isPublic: false,
          },
          { client: trx }
        )
        summary.userBottlesCreated++
        createdCounts.set(v2UserId, (createdCounts.get(v2UserId) ?? 0) + 1)
      }

      for (const [userId, added] of createdCounts) {
        const user = await User.query({ client: trx }).where('id', userId).forUpdate().firstOrFail()
        user.bottlesCreatedCount = (user.bottlesCreatedCount ?? 0) + added
        await user.useTransaction(trx).save()
      }
    })

    return summary
  }

  private flattenBottles(payload: V1MigratePayload): { kind: BottleKind; row: V1BottleExport }[] {
    return [
      ...payload.whisky.map((row) => ({ kind: 'whisky' as const, row })),
      ...payload.beer.map((row) => ({ kind: 'beer' as const, row })),
      ...payload.rhum.map((row) => ({ kind: 'rhum' as const, row })),
    ]
  }

  private async loadCategories(): Promise<Map<V1CategorySlug, Category>> {
    const slugs: V1CategorySlug[] = ['whisky', 'beer', 'rhum']
    const map = new Map<V1CategorySlug, Category>()
    for (const slug of slugs) {
      const category = await Category.findBy('slug', slug)
      if (category) {
        map.set(slug, category)
      }
    }
    return map
  }

  private async resolvePseudo(
    desired: string,
    excludeUserId: number | null,
    trx: TransactionClientContract
  ): Promise<string> {
    const base = desired.trim().slice(0, 100) || 'user'
    let candidate = base
    let n = 0
    for (;;) {
      const query = User.query({ client: trx }).where('pseudo', candidate)
      if (excludeUserId) {
        query.whereNot('id', excludeUserId)
      }
      const clash = await query.first()
      if (!clash) {
        return candidate
      }
      n += 1
      candidate = `${base.slice(0, 90)}_${n}`
    }
  }
}
