import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EngineModule } from '../engine/engine.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { BotsService } from './bots.service.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';

@Module({
  imports: [AuthModule, EngineModule, ProgressModule],
  controllers: [GamesController],
  providers: [GamesService, BotsService],
})
export class GamesModule {}
