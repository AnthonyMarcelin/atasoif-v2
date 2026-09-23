import { test } from '@japa/runner'
import {
  V1_SKIP_USER_IDS,
  buildCatalogAttrs,
  formatBoughtAt,
  legacyBottleExternalId,
  mapFullName,
  mapUserFields,
  mergeReviewAndDescription,
  normalizeEmail,
  parseNote,
  shouldSkipV1User,
} from '#services/v1_migration/v1_field_mapper'

test.group('v1 field mapper', () => {
  test('skips duplicate user id 16 only', ({ assert }) => {
    assert.isTrue(shouldSkipV1User({ id: 16, email: 'lplin@orange.fr' }))
    assert.isFalse(shouldSkipV1User({ id: 15, email: 'lplin@orange.fr' }))
    assert.isTrue(V1_SKIP_USER_IDS.has(16))
  })

  test('maps full name and normalizes email', ({ assert }) => {
    assert.equal(mapFullName('Jean ', 'Paul'), 'Jean Paul')
    assert.equal(normalizeEmail('  Tongo33@Gmail.com '), 'tongo33@gmail.com')
    const mapped = mapUserFields({
      id: 8,
      email: 'Tongo33@Gmail.com',
      pseudo: 'Tongo',
      firstname: 'Anthony',
      lastname: 'Marcelin',
      is_verified: true,
      password: '$argon2id$fake',
    })
    assert.equal(mapped.email, 'tongo33@gmail.com')
    assert.equal(mapped.fullName, 'Anthony Marcelin')
    assert.isTrue(mapped.emailVerified)
  })

  test('formats bought_at from supplier', ({ assert }) => {
    assert.equal(formatBoughtAt('Jeudi', null), 'Jeudi')
    assert.equal(formatBoughtAt('Cave', '12 rue X'), 'Cave — 12 rue X')
    assert.isNull(formatBoughtAt(null, null))
  })

  test('merges review and description without losing either', ({ assert }) => {
    assert.deepEqual(mergeReviewAndDescription('A', 'B'), {
      review: 'A',
      descriptionAttr: 'B',
    })
    assert.deepEqual(mergeReviewAndDescription('', 'only desc'), {
      review: 'only desc',
      descriptionAttr: null,
    })
    assert.deepEqual(mergeReviewAndDescription('same', 'same'), {
      review: 'same',
      descriptionAttr: null,
    })
  })

  test('keeps notes as-is (/10)', ({ assert }) => {
    assert.equal(parseNote(1.6), 1.6)
    assert.equal(parseNote('10.0'), 10)
    assert.isNull(parseNote(null))
  })

  test('builds catalog attrs and legacy external ids', ({ assert }) => {
    const attrs = buildCatalogAttrs(
      {
        id: 5,
        name: 'Ben bracken',
        description: 'Bon whisky',
        review: 'Pas mal',
        note: 6,
        price: 18,
        photo: 'https://example.test/p.jpg',
        origin_country: 'Écosse',
        supplier_name: 'Lidl',
        supplier_address: null,
        type_name: 'Single Malt',
        label_name: 'Bon',
        label_color: '#0F0',
        peat_level_name: 'Peu tourbé',
        user_id: 8,
      },
      'whisky'
    )
    assert.deepEqual(attrs.v1, { table: 'whisky', id: 5 })
    assert.equal(attrs.type, 'Single Malt')
    assert.equal(attrs.peatLevel, 'Peu tourbé')
    assert.equal(attrs.qualityLabel, 'Bon')
    assert.equal(legacyBottleExternalId('beer', 2), 'beer:2')
  })
})
