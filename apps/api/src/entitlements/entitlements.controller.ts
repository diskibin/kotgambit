import type { Entitlements } from '@kotgambit/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { EntitlementsService } from './entitlements.service.js';

@Controller('entitlements')
@UseGuards(AccessTokenGuard)
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  get(@CurrentUserId() userId: string): Promise<Entitlements> {
    return this.entitlements.get(userId);
  }
}
