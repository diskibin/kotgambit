import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { loadConfig } from '../src/config/config.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export interface TestApp {
  app: NestFastifyApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await setupApp(app, loadConfig(process.env));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, prisma: app.get(PrismaService) };
}
