/**
 * Walk Adonis / Knex wrappers for a Postgres unique violation.
 * Returns the constraint name, or `23505` when the code is present without one.
 */
export function readPostgresUniqueViolation(error: unknown): string | null {
  const seen = new Set<unknown>()
  let current: unknown = error
  let codeOnly = false

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const record = current as {
      code?: unknown
      constraint?: unknown
      cause?: unknown
      original?: unknown
      parent?: unknown
    }
    if (record.code === '23505') {
      if (typeof record.constraint === 'string' && record.constraint.length > 0) {
        return record.constraint
      }
      codeOnly = true
    }
    current = record.cause ?? record.original ?? record.parent
  }

  return codeOnly ? '23505' : null
}
