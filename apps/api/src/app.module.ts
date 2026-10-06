import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AdminModule } from './admin/admin.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { BillingModule } from './billing/billing.module.js';
import { CardsModule } from './cards/cards.module.js';
import { AnalysisModule } from './analysis/analysis.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CONFIG, ConfigModule, type AppConfig } from './config/config.module.js';
import { EntitlementsModule } from './entitlements/entitlements.module.js';
import { EngineModule } from './engine/engine.module.js';
import { GamesModule } from './games/games.module.js';
import { HealthController } from './health/health.controller.js';
import { ReadyController } from './health/ready.controller.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { MailModule } from './mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { PuzzlesModule } from './puzzles/puzzles.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { RedisModule } from './redis/redis.module.js';
import { UsersModule } from './users/users.module.js';

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
    PrismaModule,
    RedisModule,
    MailModule,
    RateLimitModule,
    AuthModule,
    UsersModule,
    ProgressModule,
    LessonsModule,
    EngineModule,
    PuzzlesModule,
    GamesModule,
    AnalysisModule,
    BillingModule,
    AdminModule,
    AnalyticsModule,
    RemindersModule,
    EntitlementsModule,
    CardsModule,
    ProfileModule,
    LoggerModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
          // Reuses the id from a reverse proxy so that one request can be followed across services
          genReqId: (req) => req.headers['x-request-id']?.toString() ?? randomUUID(),
          autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
        },
      }),
    }),
  ],
  controllers: [HealthController, ReadyController],
})
export class AppModule {}
