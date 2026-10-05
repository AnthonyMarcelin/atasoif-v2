export type ImageExt = 'jpg' | 'png' | 'webp'

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex')

/** Sniff jpeg / png / webp from the file header. Client extension is not trusted. */
export function imageExtForHeader(header: Buffer): ImageExt | null {
  if (
    header.length >= PNG_SIGNATURE.length &&
    header.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return 'png'
  }
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'jpg'
  }
  if (
    header.length >= 12 &&
    header.toString('ascii', 0, 4) === 'RIFF' &&
    header.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

/**
 * HEIC/HEIF brands live in the ISO BMFF `ftyp` box (bytes 4–8 = 'ftyp').
 * Common brands: heic, heix, hevc, hevx, mif1, msf1, heim, heis.
 */
export function isHeicHeader(header: Buffer): boolean {
  if (header.length < 12) {
    return false
  }
  if (header.toString('ascii', 4, 8) !== 'ftyp') {
    return false
  }
  const brand = header.toString('ascii', 8, 12).toLowerCase()
  return (
    brand.startsWith('hei') ||
    brand === 'mif1' ||
    brand === 'msf1' ||
    brand === 'hevc' ||
    brand === 'hevx'
  )
}
