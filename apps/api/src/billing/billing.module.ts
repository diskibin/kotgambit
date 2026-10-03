import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { YooKassaProvider } from './yookassa.provider.js';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [CONFIG],
      useFactory: (config: AppConfig) =>
        config.billing
          ? new YooKassaProvider(config.billing.shopId, config.billing.secretKey)
          : null,
    },
    BillingService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
