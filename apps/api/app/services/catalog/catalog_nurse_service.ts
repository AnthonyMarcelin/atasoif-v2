import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DateTime } from 'luxon'
import CatalogLookupService, {
  normalizeBarcode,
  type CatalogBarcodeResult,
} from '#services/catalog/catalog_lookup_service'

export type NurseEanKind = 'real' | 'placeholder' | 'unmarked'

export type NurseEanEntry = {
  barcode: string
  kind: NurseEanKind
  note: string | null
  line: number
}

export type NurseBarcodeStatus =
  | 'cache'
  | 'openfoodfacts'
  | 'upcitemdb'
  | 'miss'
  | 'dry_run_cache'
  | 'dry_run_remote'
  | 'invalid'
  | 'skipped_completed'
  | 'skipped_budget'

export type NurseBarcodeOutcome = {
  barcode: string
  kind: NurseEanKind
  status: NurseBarcodeStatus
  bottleId: number | null
  remoteCall: boolean
  message: string
}

export type NurseRunSummary = {
  processed: number
  remoteCalls: number
  cacheHits: number
  upserts: number
  misses: number
  skipped: number
  stoppedForBudget: boolean
  dryRun: boolean
  outcomes: NurseBarcodeOutcome[]
}

export type NurseStateFile = {
  day: string
  remoteCallsToday: number
  completed: Record<
    string,
    {
      status: NurseBarcodeStatus
      bottleId: number | null
      at: string
    }
  >
}

export type CatalogNurseOptions = {
  entries: NurseEanEntry[]
  statePath: string
  dailyLimit: number
  dryRun: boolean
  force: boolean
  limit?: number
  delayMs: number
  now?: DateTime
  sleep?: (ms: number) => Promise<void>
  lookup?: CatalogLookupService
}

const SECTION_REAL = /^\s*#\s*REAL\b/i
const SECTION_PLACEHOLDER = /^\s*#\s*PLACEHOLDER\b/i

/**
 * Parse curated EAN list (comments + REAL / PLACEHOLDER sections).
 */
export function parseEanList(content: string): NurseEanEntry[] {
  const entries: NurseEanEntry[] = []
  let kind: NurseEanKind = 'unmarked'
  const lines = content.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? ''
    const trimmed = raw.trim()
    if (!trimmed) {
      continue
    }

    if (SECTION_REAL.test(trimmed)) {
      kind = 'real'
      continue
    }
    if (SECTION_PLACEHOLDER.test(trimmed)) {
      kind = 'placeholder'
      continue
    }
    if (trimmed.startsWith('#')) {
      continue
    }

    const withoutInline = trimmed.replace(/\s+#.*$/, '').trim()
    const [token, ...rest] = withoutInline.split(/\s+/)
    const barcode = normalizeBarcode(token ?? '')
    const note = rest.length > 0 ? rest.join(' ').trim() : null

    if (!barcode) {
      entries.push({
        barcode: token ?? '',
        kind,
        note: note ?? 'invalid barcode',
        line: i + 1,
      })
      continue
    }

    entries.push({ barcode, kind, note, line: i + 1 })
  }

  return entries
}

export async function loadEanListFile(path: string): Promise<NurseEanEntry[]> {
  const content = await readFile(path, 'utf8')
  return parseEanList(content)
}

export function utcDayKey(now: DateTime = DateTime.utc()): string {
  return now.toUTC().toISODate() ?? '1970-01-01'
}

export async function loadNurseState(path: string, now: DateTime = DateTime.utc()): Promise<NurseStateFile> {
  const today = utcDayKey(now)
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as NurseStateFile
    if (parsed.day !== today) {
      return { day: today, remoteCallsToday: 0, completed: parsed.completed ?? {} }
    }
    return {
      day: today,
      remoteCallsToday: Number(parsed.remoteCallsToday) || 0,
      completed: parsed.completed ?? {},
    }
  } catch {
    return { day: today, remoteCallsToday: 0, completed: {} }
  }
}

export async function saveNurseState(path: string, state: NurseStateFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Pre-launch nurse: walk curated EANs, cache-first, then OFF → UPCitemdb upsert.
 * Bounded by a daily remote-call budget (UPCitemdb free Explorer ~100/day).
 */
export default class CatalogNurseService {
  async run(options: CatalogNurseOptions): Promise<NurseRunSummary> {
    const now = options.now ?? DateTime.utc()
    const sleep = options.sleep ?? defaultSleep
    const lookup = options.lookup ?? new CatalogLookupService()
    const state = await loadNurseState(options.statePath, now)

    const summary: NurseRunSummary = {
      processed: 0,
      remoteCalls: 0,
      cacheHits: 0,
      upserts: 0,
      misses: 0,
      skipped: 0,
      stoppedForBudget: false,
      dryRun: options.dryRun,
      outcomes: [],
    }

    let remaining = options.limit ?? Number.POSITIVE_INFINITY

    for (const entry of options.entries) {
      if (remaining <= 0) {
        break
      }

      const normalized = normalizeBarcode(entry.barcode)
      if (!normalized) {
        summary.outcomes.push({
          barcode: entry.barcode,
          kind: entry.kind,
          status: 'invalid',
          bottleId: null,
          remoteCall: false,
          message: `Invalid barcode at line ${entry.line}`,
        })
        summary.processed += 1
        remaining -= 1
        continue
      }

      if (!options.force && state.completed[normalized]) {
        const prev = state.completed[normalized]
        summary.outcomes.push({
          barcode: normalized,
          kind: entry.kind,
          status: 'skipped_completed',
          bottleId: prev.bottleId,
          remoteCall: false,
          message: `Already completed (${prev.status})`,
        })
        summary.skipped += 1
        summary.processed += 1
        remaining -= 1
        continue
      }

      let cached: Awaited<ReturnType<CatalogLookupService['findLocalByBarcode']>> = null
      try {
        cached = await lookup.findLocalByBarcode(normalized)
      } catch (error) {
        // Dry-run must not require a live DB; persist mode surfaces the failure.
        if (!options.dryRun) {
          throw error
        }
        cached = null
      }

      if (cached) {
        const outcome: NurseBarcodeOutcome = {
          barcode: normalized,
          kind: entry.kind,
          status: options.dryRun ? 'dry_run_cache' : 'cache',
          bottleId: cached.id,
          remoteCall: false,
          message: options.dryRun ? 'Dry-run cache hit' : 'Local cache hit',
        }
        summary.outcomes.push(outcome)
        summary.cacheHits += 1
        summary.processed += 1
        remaining -= 1
        if (!options.dryRun) {
          state.completed[normalized] = {
            status: 'cache',
            bottleId: cached.id,
            at: now.toUTC().toISO() ?? '',
          }
        }
        continue
      }

      if (state.remoteCallsToday >= options.dailyLimit) {
        summary.outcomes.push({
          barcode: normalized,
          kind: entry.kind,
          status: 'skipped_budget',
          bottleId: null,
          remoteCall: false,
          message: `Daily remote budget reached (${options.dailyLimit})`,
        })
        summary.skipped += 1
        summary.stoppedForBudget = true
        summary.processed += 1
        break
      }

      if (options.dryRun) {
        summary.outcomes.push({
          barcode: normalized,
          kind: entry.kind,
          status: 'dry_run_remote',
          bottleId: null,
          remoteCall: false,
          message: 'Dry-run would call OFF then UPCitemdb',
        })
        summary.processed += 1
        remaining -= 1
        continue
      }

      if (options.delayMs > 0 && summary.remoteCalls > 0) {
        await sleep(options.delayMs)
      }

      const result = await lookup.lookupByBarcode(normalized)
      state.remoteCallsToday += 1
      summary.remoteCalls += 1

      const outcome = this.mapLookupResult(normalized, entry.kind, result)
      summary.outcomes.push(outcome)
      summary.processed += 1
      remaining -= 1

      if (outcome.status === 'miss') {
        summary.misses += 1
      } else if (outcome.status === 'openfoodfacts' || outcome.status === 'upcitemdb') {
        summary.upserts += 1
      } else if (outcome.status === 'cache') {
        summary.cacheHits += 1
      }

      state.completed[normalized] = {
        status: outcome.status,
        bottleId: outcome.bottleId,
        at: DateTime.utc().toISO() ?? '',
      }
    }

    if (!options.dryRun) {
      await saveNurseState(options.statePath, state)
    }

    return summary
  }

  private mapLookupResult(
    barcode: string,
    kind: NurseEanKind,
    result: CatalogBarcodeResult | null
  ): NurseBarcodeOutcome {
    if (!result) {
      return {
        barcode,
        kind,
        status: 'miss',
        bottleId: null,
        remoteCall: true,
        message: 'Providers miss (OFF + UPCitemdb)',
      }
    }

    const status: NurseBarcodeStatus =
      result.origin === 'cache'
        ? 'cache'
        : result.origin === 'openfoodfacts'
          ? 'openfoodfacts'
          : 'upcitemdb'

    return {
      barcode,
      kind,
      status,
      bottleId: result.bottle.id,
      remoteCall: result.origin !== 'cache',
      message: `Upserted from ${result.origin}`,
    }
  }
}
