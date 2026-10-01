import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const API_DIR = fileURLToPath(new URL('..', import.meta.url));

/** One throwaway Postgres and Redis for the whole test run, so tests never touch the development database. */
export async function setup(): Promise<() => Promise<void>> {
  const [container, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:17-alpine').start(),
    new RedisContainer('redis:8-alpine').start(),
  ]);
  const url = container.getConnectionUri();
  process.env['DATABASE_URL'] = url;
  process.env['REDIS_URL'] = redis.getConnectionUrl();

  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  return async () => {
    await Promise.all([container.stop(), redis.stop()]);
  };
}
