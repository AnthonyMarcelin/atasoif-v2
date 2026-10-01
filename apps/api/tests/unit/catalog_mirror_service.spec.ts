import { test } from '@japa/runner'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import CatalogImageMirror from '#services/catalog/catalog_image_mirror'
import {
  defaultOffPublicBaseUrl,
  resolveRemotePhotoUrl,
} from '#services/catalog/catalog_mirror_service'
import { sanitizeRemotePhotoUrl } from '#services/catalog/catalog_lookup_service'
import type Bottle from '#models/bottle'

test.group('CatalogImageMirror defaults', () => {
  test('defaults public URL to /api/v1/media/off/{barcode}.ext', async ({ assert }) => {
    const dir = await mkdtemp(join(tmpdir(), 'off-mirror-'))
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    const mirror = new CatalogImageMirror({
      storageRoot: dir,
      userAgent: 'AtasoifTest/0.1',
      fetchImpl: async () =>
        new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
    })

    const result = await mirror.mirrorFrontImage('https://images.example/front.jpg', '5000267024202')
    assert.isNotNull(result)
    assert.equal(result!.photoUrl, '/api/v1/media/off/5000267024202.jpg')
    const written = await readFile(result!.localPath)
    assert.deepEqual(written, bytes)
    assert.equal(mirror.resolveOffCatalogFile('5000267024202.jpg'), result!.localPath)
    assert.isNull(mirror.resolveOffCatalogFile('../etc/passwd'))
  })
})

test.group('catalog mirror helpers', () => {
  test('defaultOffPublicBaseUrl falls back to media/off', ({ assert }) => {
    assert.equal(defaultOffPublicBaseUrl(null), '/api/v1/media/off')
    assert.equal(defaultOffPublicBaseUrl(''), '/api/v1/media/off')
    assert.equal(defaultOffPublicBaseUrl('https://cdn.example/off/'), 'https://cdn.example/off')
  })

  test('resolveRemotePhotoUrl prefers http photoUrl then attrs.offImageUrl', ({ assert }) => {
    const withRemote = {
      photoUrl: 'https://images.openfoodfacts.org/a.jpg',
      attrs: {},
    } as Bottle
    assert.equal(resolveRemotePhotoUrl(withRemote), 'https://images.openfoodfacts.org/a.jpg')

    const mirrored = {
      photoUrl: '/api/v1/media/off/5000267024202.jpg',
      attrs: { offImageUrl: 'https://images.openfoodfacts.org/a.jpg' },
    } as Bottle
    assert.equal(resolveRemotePhotoUrl(mirrored), 'https://images.openfoodfacts.org/a.jpg')

    const none = { photoUrl: null, attrs: {} } as Bottle
    assert.isNull(resolveRemotePhotoUrl(none))
  })

  test('sanitizeRemotePhotoUrl keeps OFF media paths', ({ assert }) => {
    assert.equal(
      sanitizeRemotePhotoUrl('/api/v1/media/off/5000267024202.jpg'),
      '/api/v1/media/off/5000267024202.jpg'
    )
    assert.isNull(sanitizeRemotePhotoUrl('/var/lib/atasoif/catalog-images/x.jpg'))
  })
})
