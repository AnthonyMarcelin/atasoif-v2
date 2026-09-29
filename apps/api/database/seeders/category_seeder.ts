import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'

const CATEGORIES = [
  { slug: 'whisky', name: 'Whisky' },
  { slug: 'rhum', name: 'Rhum' },
  { slug: 'beer', name: 'Bière' },
  { slug: 'wine', name: 'Vin' },
  { slug: 'gin', name: 'Gin' },
  { slug: 'cognac', name: 'Cognac' },
  { slug: 'vodka', name: 'Vodka' },
  { slug: 'liqueur', name: 'Liqueur' },
  { slug: 'other', name: 'Autre' },
] as const

export default class extends BaseSeeder {
  async run() {
    for (const category of CATEGORIES) {
      await Category.updateOrCreate({ slug: category.slug }, { name: category.name })
    }
  }
}
