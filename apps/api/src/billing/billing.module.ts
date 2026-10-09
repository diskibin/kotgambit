import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { RobokassaProvider } from './robokassa.provider.js';
import { YooKassaProvider } from './yookassa.provider.js';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => {
        const provider = config.billing?.provider;
        if (!provider) return null;
        return provider.kind === 'robokassa'
          ? new RobokassaProvider(provider)
          : new YooKassaProvider(provider.shopId, provider.secretKey, fetch, provider.receipt);
      },
    },
    BillingService,
  ],
  exports: [BillingService],
})
export class BillingModule {}
