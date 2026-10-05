import { test } from '@japa/runner'
import { imageExtForHeader, isHeicHeader } from '#services/image_signature'

test.group('image_signature', () => {
  test('sniffs png jpeg webp', ({ assert }) => {
    const png = Buffer.from('89504e470d0a1a0a00000000', 'hex')
    assert.equal(imageExtForHeader(png), 'png')

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    assert.equal(imageExtForHeader(jpeg), 'jpg')

    const webp = Buffer.alloc(16)
    webp.write('RIFF', 0)
    webp.write('WEBP', 8)
    assert.equal(imageExtForHeader(webp), 'webp')
  })

  test('detects HEIC ftyp brands', ({ assert }) => {
    const heic = Buffer.alloc(16)
    heic.writeUInt32BE(0, 0)
    heic.write('ftyp', 4)
    heic.write('heic', 8)
    assert.isTrue(isHeicHeader(heic))
    assert.isNull(imageExtForHeader(heic))

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    assert.isFalse(isHeicHeader(jpeg))
  })
})
