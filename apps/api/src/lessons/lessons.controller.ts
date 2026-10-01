import {
  CompleteLessonRequestSchema,
  type CatalogResponse,
  type CompleteLessonResponse,
  type LessonDetail,
} from '@kotgambit/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LessonsService } from './lessons.service.js';

type Complete = z.output<typeof CompleteLessonRequestSchema>;

@Controller('lessons')
@UseGuards(AccessTokenGuard)
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get()
  catalog(@CurrentUserId() userId: string): Promise<CatalogResponse> {
    return this.lessons.catalog(userId);
  }

  @Get(':id')
  detail(@CurrentUserId() userId: string, @Param('id') id: string): Promise<LessonDetail> {
    return this.lessons.detail(userId, id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteLessonRequestSchema)) body: Complete,
  ): Promise<CompleteLessonResponse> {
    return this.lessons.complete(userId, id, body);
  }
}
