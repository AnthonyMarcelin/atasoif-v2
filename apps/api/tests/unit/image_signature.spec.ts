import { test } from '@japa/runner'
import { imageExtForHeader } from '#services/image_signature'

test.group('Image signature', () => {
  test('accepts png, jpeg and webp headers', ({ assert }) => {
    const png = Buffer.from('89504e470d0a1a0a00000000', 'hex')
    assert.equal(imageExtForHeader(png), 'png')

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    assert.equal(imageExtForHeader(jpeg), 'jpg')

    const webp = Buffer.alloc(12)
    webp.write('RIFF', 0, 'ascii')
    webp.write('WEBP', 8, 'ascii')
    assert.equal(imageExtForHeader(webp), 'webp')
  })

  test('rejects a text payload renamed as jpeg', ({ assert }) => {
    assert.isNull(imageExtForHeader(Buffer.from('pas une image')))
  })
})
