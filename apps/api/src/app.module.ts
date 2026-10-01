import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { CONFIG, ConfigModule, type AppConfig } from './config/config.module.js';
import { HealthController } from './health/health.controller.js';

// Secrets that must never reach the logs, see PLAN.md 15.5
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.refreshToken',
];

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
          // Reuses the id from a reverse proxy so that one request can be followed across services
          genReqId: (req) => req.headers['x-request-id']?.toString() ?? randomUUID(),
          autoLogging: { ignore: (req) => req.url === '/health' },
        },
      }),
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
