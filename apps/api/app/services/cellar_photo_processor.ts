import sharp from 'sharp'
import { CollectionError } from '#services/collection/collection_error'
import { imageExtForHeader, isHeicHeader, type ImageExt } from '#services/image_signature'

export type ProcessedCellarPhoto = {
  buffer: Buffer
  ext: ImageExt
}

/**
 * Normalize cellar uploads with Sharp: HEIC/HEIF → jpeg, optional re-encode for heavy files.
 * Requires libheif in the runtime image for iPhone HEIC.
 */
export default class CellarPhotoProcessor {
  async process(input: Buffer, opts: { forceEncode?: boolean } = {}): Promise<ProcessedCellarPhoto> {
    if (!input.length) {
      throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
    }

    const header = input.subarray(0, 16)
    const sniffed = imageExtForHeader(header)
    const heic = isHeicHeader(header)

    if (!sniffed && !heic) {
      throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
    }

    if (sniffed && !heic && !opts.forceEncode) {
      return { buffer: input, ext: sniffed }
    }

    try {
      const pipeline = sharp(input, { failOn: 'none', unlimited: true }).rotate()
      // jpeg keeps broad WebView compatibility after HEIC conversion.
      const buffer = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
      return { buffer, ext: 'jpg' }
    } catch {
      throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
    }
  }
}
