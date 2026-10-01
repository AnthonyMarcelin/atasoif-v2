import { test } from '@japa/runner'
import {
  isCatalogPhotoUrl,
  isHttpPhotoUrl,
  isOffCatalogPhotoUrl,
  isOwnShelfPhotoUrl,
} from '#services/photo_url'

test.group('Photo URL allowlist', () => {
  test('allows http(s), catalog UUID media, and OFF mirrored media paths', ({ assert }) => {
    assert.isTrue(isCatalogPhotoUrl('https://example.com/gin.jpg'))
    assert.isTrue(
      isCatalogPhotoUrl('/api/v1/media/catalog/550e8400-e29b-41d4-a716-446655440000.png')
    )
    assert.isTrue(isOffCatalogPhotoUrl('/api/v1/media/off/5000267024202.jpg'))
    assert.isTrue(isCatalogPhotoUrl('/api/v1/media/off/5000267024202.jpg'))
    assert.isFalse(isCatalogPhotoUrl('javascript:alert(1)'))
    assert.isFalse(isCatalogPhotoUrl('/api/v1/account/profile'))
    assert.isFalse(isCatalogPhotoUrl('/api/v1/collection/bottles/4/photo'))
    assert.isFalse(isOffCatalogPhotoUrl('/api/v1/media/catalog/5000267024202.jpg'))
    assert.isFalse(isHttpPhotoUrl('https://user:secret@example.com/a.jpg'))
  })

  test('shelf override matches only that row', ({ assert }) => {
    assert.isTrue(isOwnShelfPhotoUrl('/api/v1/collection/bottles/4/photo', 4))
    assert.isFalse(isOwnShelfPhotoUrl('/api/v1/collection/bottles/4/photo', 5))
    assert.isFalse(isOwnShelfPhotoUrl('/api/v1/account/profile', 4))
  })
})
