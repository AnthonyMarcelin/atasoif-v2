import { createWriteStream } from 'node:fs'
import { mkdir, access } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

export type CatalogImageMirrorOptions = {
  storageRoot: string
  userAgent: string
  /** Optional public URL prefix, e.g. https://api.example/media/catalog */
  publicBaseUrl?: string | null
  fetchImpl?: typeof fetch
}

export type CatalogImageMirrorResult = {
  localPath: string
  photoUrl: string
}

/**
 * Download an OFF front image onto local VPS disk (no CDN hotlink).
 * Scaffold until a shared Drive/R2 layer exists — see docs/CATALOG-SEED.md.
 */
export default class CatalogImageMirror {
  constructor(private readonly options: CatalogImageMirrorOptions) {}

  async mirrorFrontImage(
    remoteUrl: string,
    barcode: string
  ): Promise<CatalogImageMirrorResult | null> {
    const url = remoteUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return null
    }

    const extension = guessExtension(url)
    const relativeName = `${sanitizeBarcode(barcode)}${extension}`
    const localPath = join(this.options.storageRoot, relativeName)

    await mkdir(dirname(localPath), { recursive: true })

    const fetchImpl = this.options.fetchImpl ?? fetch
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': this.options.userAgent,
        Accept: 'image/*',
      },
      redirect: 'follow',
    })

    if (!response.ok || !response.body) {
      return null
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      return null
    }

    const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
    await pipeline(nodeStream, createWriteStream(localPath))

    const photoUrl = this.options.publicBaseUrl
      ? `${trimTrailingSlash(this.options.publicBaseUrl)}/${relativeName}`
      : localPath

    return { localPath, photoUrl }
  }

  async assertStorageWritable(): Promise<void> {
    await mkdir(this.options.storageRoot, { recursive: true })
    await access(this.options.storageRoot)
  }
}

function sanitizeBarcode(barcode: string): string {
  return barcode.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 32) || 'unknown'
}

function guessExtension(url: string): string {
  try {
    const path = new URL(url).pathname
    const ext = extname(path).toLowerCase()
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return ext === '.jpeg' ? '.jpg' : ext
    }
  } catch {
    // fall through
  }
  return '.jpg'
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
