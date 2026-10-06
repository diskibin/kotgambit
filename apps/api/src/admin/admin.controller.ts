import { StatsQuerySchema, type AdminStats } from '@kotgambit/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(AccessTokenGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(
    @Query('days', new ZodValidationPipe(StatsQuerySchema))
    days: number,
  ): Promise<AdminStats> {
    return this.admin.stats(days);
  }
}
