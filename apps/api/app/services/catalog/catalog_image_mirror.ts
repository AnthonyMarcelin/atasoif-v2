import { createWriteStream } from 'node:fs'
import { mkdir, access } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { OFF_CATALOG_MEDIA_PREFIX } from '#services/photo_url'

export type CatalogImageMirrorOptions = {
  storageRoot: string
  userAgent: string
  /**
   * Public URL prefix for photoUrl. Defaults to `/api/v1/media/off` (auth media route).
   * Absolute https base also allowed once a CDN/static front exists.
   */
  publicBaseUrl?: string | null
  fetchImpl?: typeof fetch
}

const OFF_FILE_NAME = /^[0-9A-Za-z_-]{8,32}\.(jpg|jpeg|png|webp|gif)$/i

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

    const base = trimTrailingSlash(
      (this.options.publicBaseUrl && this.options.publicBaseUrl.trim()) ||
        trimTrailingSlash(OFF_CATALOG_MEDIA_PREFIX)
    )
    const photoUrl = `${base}/${relativeName}`

    return { localPath, photoUrl }
  }

  async assertStorageWritable(): Promise<void> {
    await mkdir(this.options.storageRoot, { recursive: true })
    await access(this.options.storageRoot)
  }

  /**
   * Resolve a mirrored OFF filename under storageRoot (path-traversal safe).
   * `name` is the `:name` route param (e.g. `5000267024202.jpg`).
   */
  resolveOffCatalogFile(name: string): string | null {
    if (!name || name !== basename(name) || !OFF_FILE_NAME.test(name)) {
      return null
    }
    const root = resolve(this.options.storageRoot)
    const target = resolve(join(root, name))
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`
    if (target !== root && !target.startsWith(prefix)) {
      return null
    }
    return target
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
