import { SetAccessoryRequestSchema, type Profile, type Wardrobe } from '@kotgambit/contracts';
import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProfileService } from './profile.service.js';

const ProfileQuerySchema = z.object({
  /** The learner's calendar day, YYYY-MM-DD. Without it the server's UTC date is used. */
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

@Controller('profile')
@UseGuards(AccessTokenGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(ProfileQuerySchema)) query: z.output<typeof ProfileQuerySchema>,
  ): Promise<Profile> {
    return this.profile.profile(userId, query.localDate);
  }

  @Put('accessory')
  setAccessory(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(SetAccessoryRequestSchema))
    body: z.output<typeof SetAccessoryRequestSchema>,
  ): Promise<Wardrobe> {
    return this.profile.setAccessory(userId, body.accessory);
  }
}
