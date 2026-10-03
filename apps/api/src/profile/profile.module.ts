import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CardsModule } from '../cards/cards.module.js';
import { GamesModule } from '../games/games.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { PuzzlesModule } from '../puzzles/puzzles.module.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
  imports: [AuthModule, ProgressModule, CardsModule, GamesModule, PuzzlesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
