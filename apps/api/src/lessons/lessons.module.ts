import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { LessonsController } from './lessons.controller.js';
import { LessonsService } from './lessons.service.js';

@Module({
  imports: [AuthModule, ProgressModule, EntitlementsModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
