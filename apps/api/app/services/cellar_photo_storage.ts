import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import app from '@adonisjs/core/services/app'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import env from '#start/env'
import { CollectionError } from '#services/collection/collection_error'

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024

const FILE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i

const ALLOWED_SUBTYPES = new Set(['jpeg', 'jpg', 'png', 'webp'])

export const CATALOG_PHOTO_PREFIX = '/api/v1/media/catalog/'

export function overridePhotoPath(userBottleId: number): string {
  return `/api/v1/collection/bottles/${userBottleId}/photo`
}

export type StoredPhoto = {
  absolutePath: string
  publicPath: string
}

/**
 * Local disk for cellar uploads (E2-T04).
 * Personal overrides stay owner-only. Catalog packshots are a shared file
 * with a pending review flag on the bottle row (no admin UI yet).
 */
export default class CellarPhotoStorage {
  maxBytes(): number {
    const configured = env.get('CELLAR_PHOTO_MAX_BYTES')
    if (configured === undefined || configured === null || configured <= 0) {
      return DEFAULT_MAX_BYTES
    }
    return configured
  }

  root(): string {
    const configured = env.get('CELLAR_PHOTO_DIR')?.trim()
    if (configured) {
      return path.resolve(configured)
    }
    if (app.inTest) {
      return path.resolve(app.tmpPath('cellar-photos'))
    }
    throw new CollectionError('E_PHOTO_STORAGE', 'Le stockage photo n’est pas configuré', 503)
  }

  async storeOverride(
    userId: number,
    userBottleId: number,
    file: MultipartFile
  ): Promise<StoredPhoto> {
    const ext = this.canonicalExt(file)
    const root = this.root()
    const dir = this.overrideDir(root, userId, userBottleId)
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const filename = `${randomUUID()}.${ext}`
    const absolutePath = this.assertInside(dir, path.join(dir, filename))
    await file.move(dir, { name: filename, overwrite: false })
    this.assertInside(root, path.resolve(file.filePath ?? absolutePath))
    return { absolutePath, publicPath: overridePhotoPath(userBottleId) }
  }

  async storeCatalog(file: MultipartFile): Promise<StoredPhoto> {
    const ext = this.canonicalExt(file)
    const root = this.root()
    const dir = path.join(root, 'catalog')
    await mkdir(dir, { recursive: true })
    const filename = `${randomUUID()}.${ext}`
    const absolutePath = this.assertInside(dir, path.join(dir, filename))
    await file.move(dir, { name: filename, overwrite: false })
    this.assertInside(root, path.resolve(file.filePath ?? absolutePath))
    return { absolutePath, publicPath: `${CATALOG_PHOTO_PREFIX}${filename}` }
  }

  async deleteOverride(userId: number, userBottleId: number): Promise<void> {
    const dir = this.overrideDir(this.root(), userId, userBottleId)
    await rm(dir, { recursive: true, force: true })
  }

  async removeCatalogPublicPath(publicPath: string | null | undefined): Promise<void> {
    if (!publicPath || !publicPath.startsWith(CATALOG_PHOTO_PREFIX)) {
      return
    }
    const absolute = this.resolveCatalogFile(publicPath.slice(CATALOG_PHOTO_PREFIX.length))
    if (!absolute) {
      return
    }
    await unlink(absolute)
  }

  async findOverrideFile(userId: number, userBottleId: number): Promise<string | null> {
    const dir = this.overrideDir(this.root(), userId, userBottleId)
    let names: string[]
    try {
      names = await readdir(dir)
    } catch {
      return null
    }
    const matches = names.filter((name) => FILE_NAME.test(name))
    if (matches.length !== 1) {
      return null
    }
    return this.assertInside(dir, path.join(dir, matches[0]))
  }

  resolveCatalogFile(name: string): string | null {
    if (!name || name !== path.basename(name) || !FILE_NAME.test(name)) {
      return null
    }
    const dir = path.join(this.root(), 'catalog')
    try {
      return this.assertInside(dir, path.join(dir, name))
    } catch {
      return null
    }
  }

  openReadStream(absolutePath: string) {
    return createReadStream(absolutePath)
  }

  contentTypeFor(absolutePath: string): string {
    const ext = path.extname(absolutePath).toLowerCase()
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    return 'image/jpeg'
  }

  private canonicalExt(file: MultipartFile): 'jpg' | 'png' | 'webp' {
    const subtype = (file.subtype ?? '').toLowerCase()
    const ext = (file.extname ?? '').toLowerCase().replace(/^\./, '')
    if (!ALLOWED_SUBTYPES.has(subtype) && !ALLOWED_SUBTYPES.has(ext)) {
      throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
    }
    if (ext === 'png' || subtype === 'png') return 'png'
    if (ext === 'webp' || subtype === 'webp') return 'webp'
    if (ext === 'jpg' || ext === 'jpeg' || subtype === 'jpeg' || subtype === 'jpg') return 'jpg'
    throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
  }

  private overrideDir(root: string, userId: number, userBottleId: number): string {
    return path.join(root, 'overrides', this.idSegment(userId), this.idSegment(userBottleId))
  }

  private idSegment(id: number): string {
    if (!Number.isInteger(id) || id <= 0) {
      throw new CollectionError('E_PHOTO_INVALID', 'Photo introuvable', 404)
    }
    return String(id)
  }

  private assertInside(parent: string, candidate: string): string {
    const root = path.resolve(parent)
    const target = path.resolve(candidate)
    const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
    if (target !== root && !target.startsWith(prefix)) {
      throw new CollectionError('E_PHOTO_INVALID', 'Chemin de photo invalide', 400)
    }
    return target
  }
}
