import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { EntitlementsController } from './entitlements.controller.js';
import { EntitlementsService } from './entitlements.service.js';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
