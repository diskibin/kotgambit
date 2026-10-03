import { BotsFileSchema, validateBots, type Bot } from '@kotgambit/content-schema';
import type { BotProfile } from '@kotgambit/contracts';
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Same depth from src and from dist, so the file is found either way
const BOTS_FILE = fileURLToPath(new URL('../../../../content/bots.yaml', import.meta.url));

@Injectable()
export class BotsService {
  private readonly bots: readonly Bot[];

  constructor() {
    // A broken file stops the start: a bot with a wrong strength would only show up in a game
    const file = BotsFileSchema.parse(parse(readFileSync(BOTS_FILE, 'utf8')));
    const problems = validateBots(file);
    if (problems.length > 0) throw new Error(`content/bots.yaml: ${problems.join('; ')}`);
    this.bots = file.bots;
  }

  get(id: string): Bot | undefined {
    return this.bots.find((bot) => bot.id === id);
  }

  /** What a client may see: the strength settings stay on the server. */
  profiles(): BotProfile[] {
    return this.bots.map(
      ({ id, kind, name, instrumental, gender, level, character, summary, greeting }) => ({
        id,
        kind,
        name,
        instrumental,
        gender,
        level,
        character,
        summary,
        greeting,
      }),
    );
  }
}
