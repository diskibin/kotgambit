import { Global, Module } from '@nestjs/common';
import { loadConfig, type AppConfig } from './config.js';

export const CONFIG = Symbol('CONFIG');
export type { AppConfig };

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: (): AppConfig => loadConfig(process.env) }],
  exports: [CONFIG],
})
export class ConfigModule {}
