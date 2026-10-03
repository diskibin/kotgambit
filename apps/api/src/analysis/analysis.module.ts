import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EngineModule } from '../engine/engine.module.js';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisService } from './analysis.service.js';
import { ReviewService } from './review.service.js';

@Module({
  imports: [AuthModule, EngineModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, ReviewService],
})
export class AnalysisModule {}
