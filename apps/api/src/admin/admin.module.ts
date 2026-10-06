import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EngineModule } from '../engine/engine.module.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';
import { HealthService } from './health.service.js';
import { LearningService } from './learning.service.js';
import { PaymentsService } from './payments.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, EngineModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminGuard,
    LearningService,
    PaymentsService,
    HealthService,
    UsersService,
  ],
})
export class AdminModule {}
