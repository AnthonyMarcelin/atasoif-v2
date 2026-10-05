import { readFile, unlink } from 'node:fs/promises'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import UserBottle from '#models/user_bottle'
import CellarPhotoProcessor from '#services/cellar_photo_processor'
import CellarPhotoStorage, { overridePhotoPath } from '#services/cellar_photo_storage'
import logger from '@adonisjs/core/services/logger'

interface ProcessCellarPhotoPayload {
  userId: number
  userBottleId: number
  inboxPath: string
}

/**
 * Background Sharp convert for cellar photos heavier than the sync threshold.
 */
export default class ProcessCellarPhoto extends Job<ProcessCellarPhotoPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 2,
    timeout: '2m',
  }

  async execute() {
    const { userId, userBottleId, inboxPath } = this.payload
    const storage = new CellarPhotoStorage()
    const processor = new CellarPhotoProcessor()

    const input = await readFile(inboxPath)
    const processed = await processor.process(input, { forceEncode: true })
    await storage.storeOverrideBuffer(userId, userBottleId, processed.buffer, processed.ext)

    const row = await UserBottle.query()
      .where('id', userBottleId)
      .where('user_id', userId)
      .first()
    if (row) {
      row.photoUrlOverride = overridePhotoPath(userBottleId)
      await row.save()
    }

    await unlink(inboxPath).catch(() => undefined)
  }

  async failed(error: Error) {
    logger.error(
      { err: error, payload: this.payload },
      'ProcessCellarPhoto failed after retries'
    )
    await unlink(this.payload.inboxPath).catch(() => undefined)
  }
}
