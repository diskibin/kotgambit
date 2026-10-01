import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const API_DIR = fileURLToPath(new URL('..', import.meta.url));

/** One throwaway Postgres for the whole test run, so tests never touch the development database. */
export async function setup(): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const url = container.getConnectionUri();
  process.env['DATABASE_URL'] = url;

  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  return async () => {
    await container.stop();
  };
}
