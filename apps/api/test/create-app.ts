import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { loadConfig } from '../src/config/config.js';
import { MAIL_TRANSPORT } from '../src/mail/mail.transport.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { MemoryMailTransport } from './memory-mail.transport.js';

export interface TestApp {
  app: NestFastifyApplication;
  prisma: PrismaService;
  redis: RedisService;
  mail: MemoryMailTransport;
}

/** `configure` lets a spec swap providers, such as the engine pool, before the app is built. */
export async function createTestApp(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<TestApp> {
  const mail = new MemoryMailTransport();
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mail);
  const moduleRef = await configure(builder).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await setupApp(app, loadConfig(process.env));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, prisma: app.get(PrismaService), redis: app.get(RedisService), mail };
}
