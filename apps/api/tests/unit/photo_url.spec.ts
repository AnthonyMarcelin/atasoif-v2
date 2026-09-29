import { test } from '@japa/runner'
import { isCatalogPhotoUrl, isHttpPhotoUrl, isOwnShelfPhotoUrl } from '#services/photo_url'

test.group('Photo URL allowlist', () => {
  test('allows http(s) and the catalog media path only', ({ assert }) => {
    assert.isTrue(isCatalogPhotoUrl('https://example.com/gin.jpg'))
    assert.isTrue(
      isCatalogPhotoUrl('/api/v1/media/catalog/550e8400-e29b-41d4-a716-446655440000.png')
    )
    assert.isFalse(isCatalogPhotoUrl('javascript:alert(1)'))
    assert.isFalse(isCatalogPhotoUrl('/api/v1/account/profile'))
    assert.isFalse(isCatalogPhotoUrl('/api/v1/collection/bottles/4/photo'))
    assert.isFalse(isHttpPhotoUrl('https://user:secret@example.com/a.jpg'))
  })

  test('shelf override matches only that row', ({ assert }) => {
    assert.isTrue(isOwnShelfPhotoUrl('/api/v1/collection/bottles/4/photo', 4))
    assert.isFalse(isOwnShelfPhotoUrl('/api/v1/collection/bottles/4/photo', 5))
    assert.isFalse(isOwnShelfPhotoUrl('/api/v1/account/profile', 4))
  })
})
