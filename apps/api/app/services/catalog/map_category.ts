import { ALCOHOL_CATEGORIES, type AlcoholCategory } from '@atasoif/shared'

const CATEGORY_PATTERNS: Array<{ slug: AlcoholCategory; patterns: RegExp[] }> = [
  {
    slug: 'whisky',
    patterns: [/whisk(?:y|ies|eys)/i, /\bbourbon\b/i, /\bscotch\b/i, /\brye\b/i],
  },
  {
    slug: 'rhum',
    patterns: [/\brhum\b/i, /\brums?\b/i, /\brum\b/i],
  },
  {
    slug: 'beer',
    patterns: [/\bbeers?\b/i, /\bbi[eè]res?\b/i, /\bale\b/i, /\blager\b/i, /\bstout\b/i],
  },
  {
    slug: 'wine',
    patterns: [/\bwines?\b/i, /\bvins?\b/i, /\bchampagne\b/i, /\bcidre\b/i, /\bcider\b/i],
  },
  {
    slug: 'gin',
    patterns: [/\bgins?\b/i],
  },
  {
    slug: 'cognac',
    patterns: [/\bcognacs?\b/i, /\barmagnac\b/i, /\bbrandy\b/i],
  },
  {
    slug: 'vodka',
    patterns: [/\bvodkas?\b/i],
  },
  {
    slug: 'liqueur',
    patterns: [/\bliqueurs?\b/i, /\bcream\b/i, /\bamaro\b/i, /\baperitif\b/i, /\bdigestif\b/i],
  },
]

/**
 * Map OFF / UPCitemdb category tags or free text to a seeded AlcoholCategory slug.
 */
export function mapCategorySlug(inputs: Array<string | null | undefined>): AlcoholCategory {
  const haystack = inputs.filter((value): value is string => Boolean(value)).join(' | ')
  if (!haystack) {
    return 'other'
  }

  for (const entry of CATEGORY_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) {
      return entry.slug
    }
  }

  return 'other'
}

export function isAlcoholCategory(slug: string): slug is AlcoholCategory {
  return (ALCOHOL_CATEGORIES as readonly string[]).includes(slug)
}
