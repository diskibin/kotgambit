import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  // 0.0.0.0: the container must be reachable from the reverse proxy
  await app.listen(Number(process.env['PORT'] ?? DEFAULT_PORT), '0.0.0.0');
}

void bootstrap();
