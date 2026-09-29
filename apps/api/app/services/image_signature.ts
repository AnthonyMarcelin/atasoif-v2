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
