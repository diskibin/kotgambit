import { PrismaPg } from '@prisma/adapter-pg';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../generated/prisma/client.js';
import { seedLessons } from './seed-lessons.js';

// Usage: pnpm --filter @kotgambit/api seed [content directory]
// Premium lessons live in the private content repository, pass its lessons directory here as well.
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const defaultDir = fileURLToPath(new URL('../../../../content/lessons', import.meta.url));
const dirs = process.argv.length > 2 ? process.argv.slice(2) : [defaultDir];

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
try {
  for (const dir of dirs) {
    console.log(`Seeded ${await seedLessons(prisma, dir)} lesson(s) from ${dir}`);
  }
} finally {
  await prisma.$disconnect();
}
