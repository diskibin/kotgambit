import { Module } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard.js';
import { AccountService } from './account.service.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailTokenService } from './email-token.service.js';
import { IdentitiesController } from './identities.controller.js';
import { IdentitiesService } from './identities.service.js';
import { PasswordService } from './password.service.js';
import { buildAdapters } from './oauth/oauth.adapters.js';
import { OAuthController } from './oauth/oauth.controller.js';
import { OAUTH_ADAPTERS } from './oauth/oauth-provider.js';
import { OAuthService } from './oauth/oauth.service.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController, OAuthController, IdentitiesController],
  providers: [
    AuthService,
    AccountService,
    EmailTokenService,
    PasswordService,
    TokenService,
    AccessTokenGuard,
    OAuthService,
    IdentitiesService,
    {
      provide: OAUTH_ADAPTERS,
      useFactory: (config: AppConfig) => buildAdapters(config),
      inject: [CONFIG],
    },
  ],
  exports: [AccessTokenGuard, TokenService],
})
export class AuthModule {}
