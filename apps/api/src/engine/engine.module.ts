import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { AnalysisCache } from './analysis-cache.js';
import { spawnEngineProcess } from './engine-process.js';
import { EnginePool } from './engine-pool.js';
import { EngineController } from './engine.controller.js';
import { ENGINE_POOL, EngineService } from './engine.service.js';
import { UciEngine } from './uci-engine.js';

// A cold engine loads its network files, which takes well under this even on a slow disk
const STARTUP_TIMEOUT_MS = 10_000;

export function createEnginePool(config: AppConfig): EnginePool | null {
  const engine = config.engine;
  if (!engine) return null;
  const workers = Array.from(
    { length: engine.workers },
    () =>
      new UciEngine(() => spawnEngineProcess(engine.path), {
        uciOptions: { Threads: engine.threads, Hash: engine.hashMb },
        startupTimeoutMs: STARTUP_TIMEOUT_MS,
      }),
  );
  return new EnginePool(workers, {
    maxQueue: engine.queueLimit,
    defaultTimeoutMs: engine.timeoutMs,
    retryAfterSeconds: engine.retryAfterSeconds,
  });
}

@Module({
  imports: [AuthModule],
  controllers: [EngineController],
  providers: [
    { provide: ENGINE_POOL, inject: [CONFIG], useFactory: createEnginePool },
    AnalysisCache,
    EngineService,
  ],
  exports: [EngineService],
})
export class EngineModule implements OnModuleDestroy {
  constructor(@Inject(ENGINE_POOL) private readonly pool: EnginePool | null) {}

  onModuleDestroy(): void {
    this.pool?.close();
  }
}
