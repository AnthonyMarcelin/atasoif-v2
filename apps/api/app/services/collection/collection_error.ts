import { Exception } from '@adonisjs/core/exceptions'

export class CollectionError extends Exception {
  constructor(
    public readonly code: string,
    message: string,
    status: number,
    public readonly extras: Record<string, unknown> = {}
  ) {
    super(message, { status })
  }
}
