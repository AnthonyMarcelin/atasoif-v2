import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'
import { DateTime } from 'luxon'
import { FILL_LEVEL_DEFAULT } from '@atasoif/shared'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Bottle from '#models/bottle'
import BottleSource from '#models/bottle_source'
import User from '#models/user'
import UserBottle from '#models/user_bottle'
import Subscription from '#models/subscription'
import {
  LEGACY_SUBSCRIPTION_PLAN,
  LEGACY_SUBSCRIPTION_PROVIDER,
  LEGACY_SUBSCRIPTION_STATUS,
  V1_BOTTLE_SOURCE,
  type V1BottleRow,
  type V1CategorySlug,
  type V1UserRow,
  buildCatalogAttrs,
  legacyBottleExternalId,
  mapBottleMemoryFields,
  mapUserFields,
  normalizeEmail,
  shouldSkipV1User,
} from '#services/v1_migration/v1_field_mapper'

export type V1MigrationSummary = {
  dryRun: boolean
  users: { created: number; skippedExisting: number; skippedDuplicate: number }
  bottles: { catalogCreated: number; catalogMatched: number; userBottlesCreated: number; userBottlesSkipped: number }
  subscriptions: { upserted: number }
}

export type V1MigrationOptions = {
  dryRun?: boolean
  /** Directory with users.json / whisky.json / beer.json / rhum.json (no password hashes). */
  exportDir?: string
  /** Railway v1 Postgres URL (passwords + optional live bottle joins). Never log this. */
  databaseUrl?: string
  /**
   * Test / offline injection. When set, skips Railway + export I/O.
   * Fixtures must use fake argon2 hashes — never real production secrets.
   */
  source?: {
    users: LoadedUser[]
    bottles: LoadedBottle[]
  }
  logger?: {
    info: (message: string) => void
    warning?: (message: string) => void
  }
}

type LoadedUser = V1UserRow
type LoadedBottle = V1BottleRow & { categorySlug: V1CategorySlug }

const BOTTLE_TABLES: { table: V1CategorySlug; hasPeat: boolean }[] = [
  { table: 'whisky', hasPeat: true },
  { table: 'beer', hasPeat: false },
  { table: 'rhum', hasPeat: false },
]

/**
 * One-shot Railway v1 → Adonis v2 import (E2-T11).
 * Idempotent on email (users) and attrs_override.v1 / bottle_sources legacy ids.
 */
export default class V1MigrationService {
  async run(options: V1MigrationOptions = {}): Promise<V1MigrationSummary> {
    const dryRun = Boolean(options.dryRun)
    const log = options.logger ?? { info: () => undefined }

    const { users, bottles } = await this.loadSource(options)

    const summary: V1MigrationSummary = {
      dryRun,
      users: { created: 0, skippedExisting: 0, skippedDuplicate: 0 },
      bottles: {
        catalogCreated: 0,
        catalogMatched: 0,
        userBottlesCreated: 0,
        userBottlesSkipped: 0,
      },
      subscriptions: { upserted: 0 },
    }

    const v1ToV2UserId = new Map<number, number>()
    const categoryBySlug = await this.loadCategories()

    for (const v1User of users) {
      if (shouldSkipV1User(v1User)) {
        summary.users.skippedDuplicate++
        log.info(`skip duplicate v1 user id=${v1User.id}`)
        continue
      }

      if (!v1User.password?.startsWith('$argon2')) {
        throw new Error(`v1 user id=${v1User.id} missing argon2 password hash (refusing import)`)
      }

      const mapped = mapUserFields(v1User)
      const existing = await User.findBy('email', mapped.email)

      if (existing) {
        v1ToV2UserId.set(v1User.id, existing.id)
        summary.users.skippedExisting++
        if (!dryRun) {
          await this.ensureLegacySubscription(existing.id)
          summary.subscriptions.upserted++
        } else {
          summary.subscriptions.upserted++
        }
        continue
      }

      if (dryRun) {
        summary.users.created++
        summary.subscriptions.upserted++
        // Synthetic id so dry-run bottle loop can count without writing.
        v1ToV2UserId.set(v1User.id, -v1User.id)
        continue
      }

      const v2UserId = await this.insertUserWithArgonHash(mapped, v1User)
      v1ToV2UserId.set(v1User.id, v2UserId)
      summary.users.created++
      await this.ensureLegacySubscription(v2UserId)
      summary.subscriptions.upserted++
      log.info(`created user email=${mapped.email} v1_id=${v1User.id}`)
    }

    const bottlesCreatedByUser = new Map<number, number>()

    for (const bottle of bottles) {
      const v2UserId = v1ToV2UserId.get(bottle.user_id)
      if (v2UserId === undefined) {
        log.warning?.(`skip bottle ${bottle.categorySlug}:${bottle.id} — owner v1 user not migrated`)
        continue
      }

      if (dryRun) {
        const already = await this.findExistingUserBottle(v2UserId > 0 ? v2UserId : null, bottle)
        if (already) {
          summary.bottles.userBottlesSkipped++
        } else {
          summary.bottles.userBottlesCreated++
          summary.bottles.catalogCreated++
        }
        continue
      }

      const existingUb = await this.findExistingUserBottle(v2UserId, bottle)
      if (existingUb) {
        summary.bottles.userBottlesSkipped++
        continue
      }

      const category = categoryBySlug.get(bottle.categorySlug)
      if (!category) {
        throw new Error(`Missing category seed for slug=${bottle.categorySlug}`)
      }

      const { bottleId, created } = await this.resolveCatalogBottle(bottle, category.id)
      if (created) {
        summary.bottles.catalogCreated++
      } else {
        summary.bottles.catalogMatched++
      }

      const memory = mapBottleMemoryFields(bottle, bottle.categorySlug)
      await UserBottle.create({
        userId: v2UserId,
        bottleId,
        review: memory.review,
        note: memory.note,
        pricePaid: memory.pricePaid,
        boughtAt: memory.boughtAt,
        photoUrlOverride: memory.photoUrlOverride,
        fillLevel: FILL_LEVEL_DEFAULT,
        fillLevelUpdatesCount: 0,
        attrsOverride: memory.attrsOverride,
        isPublic: false,
      })
      summary.bottles.userBottlesCreated++
      bottlesCreatedByUser.set(v2UserId, (bottlesCreatedByUser.get(v2UserId) ?? 0) + 1)
    }

    if (!dryRun) {
      for (const [userId, added] of bottlesCreatedByUser) {
        await db.rawQuery(
          `UPDATE users SET bottles_created_count = bottles_created_count + ? WHERE id = ?`,
          [added, userId]
        )
      }
    }

    return summary
  }

  private async loadCategories(): Promise<Map<string, Category>> {
    const rows = await Category.all()
    return new Map(rows.map((c) => [c.slug, c]))
  }

  /**
   * Insert user without Lucid beforeSave re-hash (password is already `$argon2id$`).
   */
  private async insertUserWithArgonHash(
    mapped: ReturnType<typeof mapUserFields>,
    v1User: V1UserRow
  ): Promise<number> {
    const now = DateTime.utc().toSQL()
    const createdAt = v1User.created_at
      ? DateTime.fromJSDate(new Date(v1User.created_at)).toUTC().toSQL()
      : now
    const updatedAt = v1User.updated_at
      ? DateTime.fromJSDate(new Date(v1User.updated_at)).toUTC().toSQL()
      : now

    // Resolve pseudo uniqueness: if taken, suffix with v1 id.
    let pseudo = mapped.pseudo
    if (pseudo) {
      const clash = await User.findBy('pseudo', pseudo)
      if (clash) {
        pseudo = `${pseudo}_v1_${v1User.id}`.slice(0, 100)
      }
    }

    const inserted = await db
      .table('users')
      .insert({
        email: mapped.email,
        password: mapped.password,
        full_name: mapped.fullName,
        pseudo,
        is_public: false,
        image: null,
        email_verified: mapped.emailVerified,
        password_reset_version: 0,
        bottles_created_count: 0,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      .returning('id')

    const row = Array.isArray(inserted) ? inserted[0] : inserted
    if (row && typeof row === 'object' && 'id' in row) {
      return Number((row as { id: number }).id)
    }
    return Number(row)
  }

  private async ensureLegacySubscription(userId: number): Promise<void> {
    const existing = await Subscription.findBy('user_id', userId)
    if (!existing) {
      await Subscription.create({
        userId,
        plan: LEGACY_SUBSCRIPTION_PLAN,
        status: LEGACY_SUBSCRIPTION_STATUS,
        provider: LEGACY_SUBSCRIPTION_PROVIDER,
        providerCustomerId: null,
        providerSubscriptionId: null,
        currentPeriodEnd: null,
      })
      return
    }

    // Never clobber a real IAP / future billing row on idempotent re-run.
    if (existing.provider !== LEGACY_SUBSCRIPTION_PROVIDER) {
      return
    }

    existing.plan = LEGACY_SUBSCRIPTION_PLAN
    existing.status = LEGACY_SUBSCRIPTION_STATUS
    existing.providerCustomerId = null
    existing.providerSubscriptionId = null
    existing.currentPeriodEnd = null
    await existing.save()
  }

  private async findExistingUserBottle(
    v2UserId: number | null,
    bottle: LoadedBottle
  ): Promise<UserBottle | null> {
    if (!v2UserId || v2UserId < 0) {
      return null
    }
    const externalId = legacyBottleExternalId(bottle.categorySlug, bottle.id)
    const source = await BottleSource.query()
      .where('source', V1_BOTTLE_SOURCE)
      .where('external_id', externalId)
      .first()
    if (!source) {
      return null
    }
    return UserBottle.query().where('user_id', v2UserId).where('bottle_id', source.bottleId).first()
  }

  private async resolveCatalogBottle(
    bottle: LoadedBottle,
    categoryId: number
  ): Promise<{ bottleId: number; created: boolean }> {
    const externalId = legacyBottleExternalId(bottle.categorySlug, bottle.id)
    const existingSource = await BottleSource.query()
      .where('source', V1_BOTTLE_SOURCE)
      .where('external_id', externalId)
      .first()
    if (existingSource) {
      return { bottleId: existingSource.bottleId, created: false }
    }

    const name = bottle.name.trim()
    const matched = await Bottle.query()
      .whereNull('deleted_at')
      .where('category_id', categoryId)
      .whereRaw('lower(name) = ?', [name.toLowerCase()])
      .first()

    if (matched) {
      await BottleSource.create({
        bottleId: matched.id,
        source: V1_BOTTLE_SOURCE,
        externalId,
        rawHash: null,
        lastSyncedAt: DateTime.utc(),
      })
      // Personal v1 photos stay on UserBottle.photoUrlOverride — never publish to shared catalog.
      return { bottleId: matched.id, created: false }
    }

    const attrs = buildCatalogAttrs(bottle, bottle.categorySlug)
    const created = await Bottle.create({
      name,
      brand: null,
      origin: bottle.origin_country?.trim() || null,
      abv: null,
      volumeMl: null,
      barcode: null,
      photoUrl: null,
      photoStatus: null,
      attrs,
      categoryId,
    })

    await BottleSource.create({
      bottleId: created.id,
      source: V1_BOTTLE_SOURCE,
      externalId,
      rawHash: null,
      lastSyncedAt: DateTime.utc(),
    })

    return { bottleId: created.id, created: true }
  }

  private async loadSource(options: V1MigrationOptions): Promise<{
    users: LoadedUser[]
    bottles: LoadedBottle[]
  }> {
    if (options.source) {
      return options.source
    }

    const databaseUrl = options.databaseUrl?.trim() || process.env.DATABASE_PUBLIC_URL?.trim()
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_PUBLIC_URL (or --database-url) is required to load v1 password hashes. Never commit hashes.'
      )
    }

    if (options.exportDir) {
      const users = await this.loadUsersFromExport(options.exportDir, databaseUrl)
      const bottles = await this.loadBottlesFromExport(options.exportDir)
      return { users, bottles }
    }

    return this.loadEverythingFromRailway(databaseUrl)
  }

  private async withV1Client<T>(databaseUrl: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
    const client = new pg.Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20_000,
    })
    await client.connect()
    try {
      return await run(client)
    } finally {
      await client.end().catch(() => undefined)
    }
  }

  private async loadUsersFromExport(exportDir: string, databaseUrl: string): Promise<LoadedUser[]> {
    const raw = JSON.parse(await readFile(join(exportDir, 'users.json'), 'utf8')) as Array<{
      id: number
      email: string
      pseudo: string
      firstname: string
      lastname: string
      is_verified: boolean
      created_at?: string
      updated_at?: string
    }>

    const passwords = await this.withV1Client(databaseUrl, async (client) => {
      const result = await client.query<{ id: number; password: string }>(
        `SELECT id, password FROM "user" ORDER BY id`
      )
      const map = new Map<number, string>()
      for (const row of result.rows) {
        map.set(row.id, row.password)
      }
      return map
    })

    return raw.map((u) => {
      const password = passwords.get(u.id)
      if (typeof password !== 'string' || !password) {
        throw new Error(`No password row in Railway for v1 user id=${u.id}`)
      }
      return {
        id: u.id,
        email: u.email,
        pseudo: u.pseudo,
        firstname: u.firstname,
        lastname: u.lastname,
        is_verified: u.is_verified,
        password,
        created_at: u.created_at ?? null,
        updated_at: u.updated_at ?? null,
      } satisfies V1UserRow
    })
  }

  private async loadBottlesFromExport(exportDir: string): Promise<LoadedBottle[]> {
    const out: LoadedBottle[] = []
    for (const { table } of BOTTLE_TABLES) {
      const path = join(exportDir, `${table}.json`)
      const rows = JSON.parse(await readFile(path, 'utf8')) as V1BottleRow[]
      for (const row of rows) {
        out.push({ ...row, categorySlug: table })
      }
    }
    return out
  }

  private async loadEverythingFromRailway(databaseUrl: string): Promise<{
    users: LoadedUser[]
    bottles: LoadedBottle[]
  }> {
    return this.withV1Client(databaseUrl, async (client) => {
      const usersResult = await client.query<{
        id: number
        email: string
        pseudo: string
        firstname: string
        lastname: string
        is_verified: boolean
        password: string
        created_at: Date
        updated_at: Date
      }>(`
        SELECT id, email, pseudo, firstname, lastname,
               "isVerified" AS is_verified, password, created_at, updated_at
        FROM "user"
        ORDER BY id
      `)

      const users: LoadedUser[] = usersResult.rows.map((row) => ({
        ...row,
        email: normalizeEmail(row.email),
      }))

      const bottles: LoadedBottle[] = []
      for (const { table, hasPeat } of BOTTLE_TABLES) {
        const peatSelect = hasPeat
          ? `, p.name AS peat_level_name`
          : `, NULL::varchar AS peat_level_name`
        const peatJoin = hasPeat ? `LEFT JOIN peat_levels p ON p.id = b.peat_level_id` : ''
        const result = await client.query<V1BottleRow>(`
          SELECT
            b.id,
            b.name,
            b.description,
            b.review,
            b.note,
            b.price,
            b.photo,
            o.country AS origin_country,
            s.name AS supplier_name,
            s.adress AS supplier_address,
            t.name AS type_name,
            l.name AS label_name,
            l.color AS label_color
            ${peatSelect},
            b."userId" AS user_id,
            b.created_at,
            b.updated_at
          FROM ${table} b
          LEFT JOIN origin o ON o.id = b.origin_id
          LEFT JOIN supplier s ON s.id = b.supplier_id
          LEFT JOIN types t ON t.id = b.type_id
          LEFT JOIN label l ON l.id = b.label_id
          ${peatJoin}
          ORDER BY b.id
        `)
        for (const row of result.rows) {
          bottles.push({ ...row, categorySlug: table })
        }
      }

      return { users, bottles }
    })
  }
}
