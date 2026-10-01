import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import { loadConfig } from './config/config.js';

async function bootstrap(): Promise<void> {
  // Validated first: a missing variable should stop the process before anything starts
  const config = loadConfig(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  await setupApp(app, config);
  // 0.0.0.0: the container must be reachable from the reverse proxy
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
