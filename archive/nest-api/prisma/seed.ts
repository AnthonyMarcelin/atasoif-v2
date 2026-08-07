import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
] as const;

async function main() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
