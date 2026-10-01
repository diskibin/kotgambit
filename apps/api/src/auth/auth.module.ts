import { Module } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, AccessTokenGuard],
  exports: [AccessTokenGuard, TokenService],
})
export class AuthModule {}
