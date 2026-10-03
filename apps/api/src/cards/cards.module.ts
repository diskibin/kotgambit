import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';

@Module({
  imports: [AuthModule, ProgressModule, EntitlementsModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
