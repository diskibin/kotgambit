import {
  UpdateSettingsRequestSchema,
  type DataExport,
  type AccessoryKey,
  type Settings,
  type User,
} from '@kotgambit/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { AppError } from '../common/app-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DataExportService } from './data-export.service.js';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard.js';

type SettingsBody = z.output<typeof UpdateSettingsRequestSchema>;

// Changing settings is cheap, deleting an account is final: the second is held to a tighter rule
const ACCOUNT_LIMITS = {
  settingsPerUser: { name: 'settings-user', limit: 30, windowSeconds: 60, by: 'user' },
  exportPerUser: { name: 'account-export-user', limit: 5, windowSeconds: 3600, by: 'user' },
  deletePerUser: { name: 'account-delete-user', limit: 3, windowSeconds: 3600, by: 'user' },
} as const;

@Controller('users')
@UseGuards(AccessTokenGuard, RateLimitGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataExport: DataExportService,
  ) {}

  @Get('me')
  async me(@CurrentUserId() userId: string): Promise<User> {
    const user = await this.load(userId);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerifiedAt !== null,
      accessory: user.accessory as AccessoryKey,
    };
  }

  @Get('me/settings')
  async settings(@CurrentUserId() userId: string): Promise<Settings> {
    return this.settingsOf(await this.load(userId));
  }

  @Patch('me/settings')
  @RateLimit(ACCOUNT_LIMITS.settingsPerUser)
  async update(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(UpdateSettingsRequestSchema)) body: SettingsBody,
  ): Promise<Settings> {
    const current = await this.load(userId);
    // A letter to an address nobody has confirmed may reach a stranger
    if (body.reminders === true && current.emailVerifiedAt === null) {
      throw new AppError('settings.email_unverified', HttpStatus.CONFLICT);
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.dailyGoalMinutes === undefined ? {} : { dailyGoalMinutes: body.dailyGoalMinutes }),
        ...(body.displayName === undefined ? {} : { displayName: body.displayName }),
        ...(body.reminders === undefined ? {} : { remindersEnabled: body.reminders }),
      },
    });
    return this.settingsOf(user);
  }

  /** All the learner's data as one document, to keep or to move. A few times an hour is plenty. */
  @Get('me/export')
  @Header('Cache-Control', 'no-store')
  @RateLimit(ACCOUNT_LIMITS.exportPerUser)
  export(@CurrentUserId() userId: string): Promise<DataExport> {
    return this.dataExport.export(userId);
  }

  /**
   * Deletes the account with everything that hangs on it: progress, games, cards, the subscription record and the
   * tokens (all cascade). The client asks the learner to type the word first. A card the provider kept is never
   * charged again, because nothing here knows the learner any more.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(ACCOUNT_LIMITS.deletePerUser)
  async remove(@CurrentUserId() userId: string): Promise<void> {
    await this.load(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log('An account was deleted');
  }

  private async load(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // A valid token for a deleted account is as good as no token
    if (!user) throw new AppError('auth.unauthorized', HttpStatus.UNAUTHORIZED);
    return user;
  }

  private settingsOf(user: {
    dailyGoalMinutes: number;
    displayName: string | null;
    remindersEnabled: boolean;
  }): Settings {
    return {
      dailyGoalMinutes: user.dailyGoalMinutes as Settings['dailyGoalMinutes'],
      displayName: user.displayName,
      reminders: user.remindersEnabled,
    };
  }
}
