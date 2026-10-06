import {
  GrantPremiumRequestSchema,
  RevokePremiumRequestSchema,
  StatsQuerySchema,
  UserSearchQuerySchema,
  type AdminStats,
  type AdminUser,
  type AdminUserList,
  type GrantPremiumRequest,
  type LearningStats,
  type PaymentsStats,
  type RevokePremiumRequest,
  type ServerHealth,
} from '@kotgambit/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';
import { HealthService } from './health.service.js';
import { LearningService } from './learning.service.js';
import { PaymentsService } from './payments.service.js';
import { UsersService } from './users.service.js';

const userId = () => new ZodValidationPipe(z.uuid());

@Controller('admin')
@UseGuards(AccessTokenGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly learning: LearningService,
    private readonly payments: PaymentsService,
    private readonly health: HealthService,
    private readonly users: UsersService,
  ) {}

  @Get('stats')
  stats(@Query('days', new ZodValidationPipe(StatsQuerySchema)) days: number): Promise<AdminStats> {
    return this.admin.stats(days);
  }

  @Get('learning')
  learningStats(
    @Query('days', new ZodValidationPipe(StatsQuerySchema)) days: number,
  ): Promise<LearningStats> {
    return this.learning.stats(days);
  }

  @Get('payments')
  paymentsStats(
    @Query('days', new ZodValidationPipe(StatsQuerySchema)) days: number,
  ): Promise<PaymentsStats> {
    return this.payments.stats(days);
  }

  @Get('health')
  serverHealth(): Promise<ServerHealth> {
    return this.health.check();
  }

  @Get('users')
  search(
    @Query('q', new ZodValidationPipe(UserSearchQuerySchema)) query: string,
  ): Promise<AdminUserList> {
    return this.users.search(query);
  }

  @Get('users/:id')
  user(@Param('id', userId()) id: string): Promise<AdminUser> {
    return this.users.detail(id);
  }

  @Post('users/:id/premium')
  @HttpCode(HttpStatus.OK)
  grant(
    @CurrentUserId() adminId: string,
    @Param('id', userId()) id: string,
    @Body(new ZodValidationPipe(GrantPremiumRequestSchema)) body: GrantPremiumRequest,
  ): Promise<AdminUser> {
    return this.users.grant(adminId, id, body);
  }

  @Post('users/:id/premium/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @CurrentUserId() adminId: string,
    @Param('id', userId()) id: string,
    @Body(new ZodValidationPipe(RevokePremiumRequestSchema)) body: RevokePremiumRequest,
  ): Promise<AdminUser> {
    return this.users.revoke(adminId, id, body);
  }
}
