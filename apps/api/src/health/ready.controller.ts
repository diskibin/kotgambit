import type { ReadyResponse } from '@kotgambit/contracts';
import { Controller, Get } from '@nestjs/common';
import { EngineService } from '../engine/engine.service.js';

/** For the uptime monitor and for deciding when the server needs more cores: the queue numbers live here. */
@Controller('ready')
export class ReadyController {
  constructor(private readonly engine: EngineService) {}

  @Get()
  check(): ReadyResponse {
    return { status: 'ok', engine: this.engine.metrics() };
  }
}
