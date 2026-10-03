import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { PuzzleThemesService } from './puzzle-themes.service.js';
import { PuzzlesController } from './puzzles.controller.js';
import { PuzzlesService } from './puzzles.service.js';

@Module({
  imports: [AuthModule, ProgressModule],
  controllers: [PuzzlesController],
  providers: [PuzzlesService, PuzzleThemesService],
  exports: [PuzzleThemesService],
})
export class PuzzlesModule {}
