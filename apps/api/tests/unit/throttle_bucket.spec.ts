import { test } from '@japa/runner'
import { throttleScope, throttleStorageKey } from '#middleware/auth_throttle_middleware'

test.group('Throttle bucket key', () => {
  test('query string does not open a new auth window', ({ assert }) => {
    const a = throttleScope({ url: '/api/v1/auth/login?next=1' })
    const b = throttleScope({ url: '/api/v1/auth/login?next=2' })
    assert.equal(a, b)
  })

  test('barcode lookups share one bucket per user', ({ assert }) => {
    const a = throttleStorageKey({
      method: 'GET',
      scope: throttleScope({
        bucket: 'catalog-barcode',
        url: '/api/v1/catalog/bottles/barcode/11111111',
      }),
      ip: '203.0.113.4',
      userId: 7,
    })
    const b = throttleStorageKey({
      method: 'GET',
      scope: throttleScope({
        bucket: 'catalog-barcode',
        url: '/api/v1/catalog/bottles/barcode/22222222',
      }),
      ip: '203.0.113.9',
      userId: 7,
    })
    const otherUser = throttleStorageKey({
      method: 'GET',
      scope: throttleScope({
        bucket: 'catalog-barcode',
        url: '/api/v1/catalog/bottles/barcode/11111111',
      }),
      ip: '203.0.113.4',
      userId: 8,
    })

    assert.equal(a, b)
    assert.notEqual(a, otherUser)
  })
})
