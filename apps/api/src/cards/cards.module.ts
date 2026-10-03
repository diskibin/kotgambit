import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';

@Module({
  imports: [AuthModule, ProgressModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
