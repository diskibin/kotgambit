import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DataExportService } from './data-export.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [DataExportService],
})
export class UsersModule {}
