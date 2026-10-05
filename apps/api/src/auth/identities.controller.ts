import { OAuthProviderSchema, type IdentitiesResponse } from '@kotgambit/contracts';
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { CurrentUserId } from './current-user.decorator.js';
import { IdentitiesService } from './identities.service.js';

@Controller('auth/identities')
@UseGuards(AccessTokenGuard)
export class IdentitiesController {
  constructor(private readonly identities: IdentitiesService) {}

  @Get()
  list(@CurrentUserId() userId: string): Promise<IdentitiesResponse> {
    return this.identities.list(userId);
  }

  @Delete(':provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(
    @CurrentUserId() userId: string,
    @Param('provider') provider: string,
  ): Promise<void> {
    const parsed = OAuthProviderSchema.safeParse(provider);
    if (!parsed.success) throw new AppError('oauth.not_linked', HttpStatus.NOT_FOUND);
    await this.identities.unlink(userId, parsed.data);
  }
}
