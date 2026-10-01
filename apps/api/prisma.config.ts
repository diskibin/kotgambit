import { defineConfig } from 'prisma/config';

// The CLI does not read .env on its own; CI and production provide real environment variables
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env file is fine
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
