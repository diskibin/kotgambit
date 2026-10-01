import { Global, Module } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { LogMailTransport } from './log.transport.js';
import { MailService } from './mail.service.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail.transport.js';
import { SmtpMailTransport } from './smtp.transport.js';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [CONFIG],
      useFactory: (config: AppConfig): MailTransport =>
        config.smtpUrl
          ? SmtpMailTransport.fromUrl(config.smtpUrl, config.mailFrom)
          : new LogMailTransport(),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
