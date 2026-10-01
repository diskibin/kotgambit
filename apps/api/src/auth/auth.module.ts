import { Module } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard.js';
import { AccountService } from './account.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailTokenService } from './email-token.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountService,
    EmailTokenService,
    PasswordService,
    TokenService,
    AccessTokenGuard,
  ],
  exports: [AccessTokenGuard, TokenService],
})
export class AuthModule {}
