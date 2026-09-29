import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import CatalogNurseService, {
  parseEanList,
  loadNurseState,
  saveNurseState,
  utcDayKey,
} from '#services/catalog/catalog_nurse_service'
import type CatalogLookupService from '#services/catalog/catalog_lookup_service'
import type Bottle from '#models/bottle'

test.group('parseEanList', () => {
  test('splits REAL and PLACEHOLDER sections and ignores comments', ({ assert }) => {
    const entries = parseEanList(`
# header
# REAL
5000267024202  # Johnnie Walker
# PLACEHOLDER
9990000000001  # fake
# trailing comment
`)
    assert.lengthOf(entries, 2)
    assert.equal(entries[0]!.barcode, '5000267024202')
    assert.equal(entries[0]!.kind, 'real')
    assert.equal(entries[1]!.barcode, '9990000000001')
    assert.equal(entries[1]!.kind, 'placeholder')
  })

  test('keeps invalid tokens as invalid entries', ({ assert }) => {
    const entries = parseEanList('# REAL\nabc\n')
    assert.equal(entries[0]!.barcode, 'abc')
    assert.isNull(normalizeOrNull(entries[0]!.barcode))
  })
})

function normalizeOrNull(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 14) {
    return null
  }
  return digits
}

test.group('CatalogNurseService', () => {
  test('dry-run reports remote plan without calling lookupByBarcode', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'nurse-'))
    const statePath = join(dir, 'state.json')
    let lookupCalls = 0

    const lookup = {
      findLocalByBarcode: async () => null,
      lookupByBarcode: async () => {
        lookupCalls += 1
        return null
      },
    } as unknown as CatalogLookupService

    const nurse = new CatalogNurseService()
    const summary = await nurse.run({
      entries: [{ barcode: '5000267024202', kind: 'real', note: null, line: 1 }],
      statePath,
      dailyLimit: 100,
      dryRun: true,
      force: false,
      delayMs: 0,
      lookup,
      sleep: async () => undefined,
    })

    assert.equal(lookupCalls, 0)
    assert.equal(summary.outcomes[0]!.status, 'dry_run_remote')
    assert.equal(summary.remoteCalls, 0)
  })

  test('skips remote work when daily budget is exhausted', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'nurse-'))
    const statePath = join(dir, 'state.json')
    const today = utcDayKey(DateTime.utc())
    await saveNurseState(statePath, {
      day: today,
      remoteCallsToday: 100,
      completed: {},
    })

    let lookupCalls = 0
    const lookup = {
      findLocalByBarcode: async () => null,
      lookupByBarcode: async () => {
        lookupCalls += 1
        return null
      },
    } as unknown as CatalogLookupService

    const nurse = new CatalogNurseService()
    const summary = await nurse.run({
      entries: [{ barcode: '5000267024202', kind: 'real', note: null, line: 1 }],
      statePath,
      dailyLimit: 100,
      dryRun: false,
      force: false,
      delayMs: 0,
      lookup,
      sleep: async () => undefined,
    })

    assert.equal(lookupCalls, 0)
    assert.isTrue(summary.stoppedForBudget)
    assert.equal(summary.outcomes[0]!.status, 'skipped_budget')
  })

  test('cache hit does not consume remote budget and marks completed', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'nurse-'))
    const statePath = join(dir, 'state.json')
    let lookupCalls = 0

    const lookup = {
      findLocalByBarcode: async () => ({ id: 42 } as Bottle),
      lookupByBarcode: async () => {
        lookupCalls += 1
        return null
      },
    } as unknown as CatalogLookupService

    const nurse = new CatalogNurseService()
    const summary = await nurse.run({
      entries: [{ barcode: '5000267024202', kind: 'real', note: null, line: 1 }],
      statePath,
      dailyLimit: 100,
      dryRun: false,
      force: false,
      delayMs: 0,
      lookup,
      sleep: async () => undefined,
      now: DateTime.utc(),
    })

    assert.equal(lookupCalls, 0)
    assert.equal(summary.cacheHits, 1)
    assert.equal(summary.remoteCalls, 0)

    const state = JSON.parse(await readFile(statePath, 'utf8')) as {
      remoteCallsToday: number
      completed: Record<string, { status: string; bottleId: number | null }>
    }
    assert.equal(state.remoteCallsToday, 0)
    assert.equal(state.completed['5000267024202']!.status, 'cache')
    assert.equal(state.completed['5000267024202']!.bottleId, 42)
  })

  test('resume skips completed barcodes unless force', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'nurse-'))
    const statePath = join(dir, 'state.json')
    await writeFile(
      statePath,
      JSON.stringify({
        day: utcDayKey(DateTime.utc()),
        remoteCallsToday: 1,
        completed: {
          '5000267024202': { status: 'miss', bottleId: null, at: '2026-01-01T00:00:00.000Z' },
        },
      }),
      'utf8'
    )

    let findCalls = 0
    const lookup = {
      findLocalByBarcode: async () => {
        findCalls += 1
        return null
      },
      lookupByBarcode: async () => null,
    } as unknown as CatalogLookupService

    const nurse = new CatalogNurseService()
    const summary = await nurse.run({
      entries: [{ barcode: '5000267024202', kind: 'real', note: null, line: 1 }],
      statePath,
      dailyLimit: 100,
      dryRun: false,
      force: false,
      delayMs: 0,
      lookup,
      sleep: async () => undefined,
    })

    assert.equal(findCalls, 0)
    assert.equal(summary.outcomes[0]!.status, 'skipped_completed')
  })

  test('loadNurseState resets daily counter on new UTC day but keeps completed', async ({
    assert,
  }) => {
    const dir = await mkdtemp(join(tmpdir(), 'nurse-'))
    const statePath = join(dir, 'state.json')
    await saveNurseState(statePath, {
      day: '2000-01-01',
      remoteCallsToday: 99,
      completed: {
        '5000267024202': { status: 'cache', bottleId: 1, at: '2000-01-01T00:00:00.000Z' },
      },
    })

    const loaded = await loadNurseState(statePath, DateTime.utc())
    assert.equal(loaded.day, utcDayKey(DateTime.utc()))
    assert.equal(loaded.remoteCallsToday, 0)
    assert.equal(loaded.completed['5000267024202']!.bottleId, 1)
  })
})
