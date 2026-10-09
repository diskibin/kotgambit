import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import type { AppConfig } from './config/config.js';

/** Everything that main.ts and the integration tests must have in common. */
export async function setupApp(app: NestFastifyApplication, config: AppConfig): Promise<void> {
  await app.register(helmet);
  await app.register(cookie);
  // The refresh cookie needs `credentials`, which in turn forbids a wildcard origin
  await app.register(cors, { origin: config.corsOrigins, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
