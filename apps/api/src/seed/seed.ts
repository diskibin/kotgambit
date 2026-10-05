import { PrismaPg } from '@prisma/adapter-pg';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../generated/prisma/client.js';
import { seedLessons } from './seed-lessons.js';

// Usage: pnpm --filter @kotgambit/api seed [content directory ...]
// Premium lessons live in the private content repository. The deploy keeps a checkout of it and sets
// CONTENT_PRIVATE_DIR to its lessons directory, so it is seeded together with the free lessons.
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const defaultDir = fileURLToPath(new URL('../../../../content/lessons', import.meta.url));
const privateDir = process.env['CONTENT_PRIVATE_DIR'];
const dirs =
  process.argv.length > 2
    ? process.argv.slice(2)
    : [defaultDir, ...(privateDir ? [privateDir] : [])];

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
try {
  console.log(`Seeded ${await seedLessons(prisma, dirs)} lesson(s) from ${dirs.join(', ')}`);
} finally {
  await prisma.$disconnect();
}
