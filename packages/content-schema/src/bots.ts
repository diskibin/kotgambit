import { z } from 'zod';

// The cat's friends do not say an answer is wrong in those words either, see PLAN.md 6.5 and 14.2
const FORBIDDEN_WORDS = ['неверно', 'неправильно'];

/** The avatars in `kot-gambit-design/shared/assets/bots`, one animal per level. */
export const BOT_KINDS = ['mouse', 'hamster', 'fox', 'owl', 'wolf', 'bear'] as const;

// Stockfish 19 refuses `UCI_Elo` outside this range (checked against its own `uci` output, see ADR 0009)
export const STOCKFISH_MIN_ELO = 1320;
export const STOCKFISH_MAX_ELO = 3190;
const MAX_SKILL_LEVEL = 20;

/**
 * Exactly one of `skillLevel` and `elo`. Stockfish cannot be made weaker than `STOCKFISH_MIN_ELO` with
 * `UCI_Elo`, so the weakest bots use `Skill Level` and shallow searches, and the rest limit their Elo.
 */
export const BotStrengthSchema = z
  .object({
    skillLevel: z.number().int().min(0).max(MAX_SKILL_LEVEL).optional(),
    elo: z.number().int().min(STOCKFISH_MIN_ELO).max(STOCKFISH_MAX_ELO).optional(),
    depth: z.number().int().min(1).max(30).optional(),
    movetimeMs: z.number().int().min(50).max(5000),
    /** How many best lines the engine reports, the bot may pick any of them. */
    candidates: z.number().int().min(1).max(5),
    /** The chance of playing a candidate other than the best one, a way to make a bot human below the Elo floor. */
    mistakeChance: z.number().min(0).max(1),
  })
  .refine((value) => (value.skillLevel === undefined) !== (value.elo === undefined), {
    message: 'Set either skillLevel or elo',
    path: ['skillLevel'],
  })
  .refine((value) => value.mistakeChance === 0 || value.candidates > 1, {
    message: 'A bot that makes mistakes needs more than one candidate',
    path: ['candidates'],
  });
export type BotStrength = z.infer<typeof BotStrengthSchema>;

export const BotSchema = z.object({
  id: z.string().regex(/^[a-z]+$/),
  kind: z.enum(BOT_KINDS),
  name: z.string().min(1),
  /** The name after "с" ("Играть с Лисой Алисой"), Russian cannot build it from the name. */
  instrumental: z.string().min(1),
  /** For the verb of "Победила Лиса Алиса". */
  gender: z.enum(['f', 'm']),
  level: z.number().int().min(1).max(6),
  /** The text of the card on the website. */
  character: z.string().min(1),
  /** The shorter line of the list in the app. */
  summary: z.string().min(1),
  greeting: z.string().min(1),
  strength: BotStrengthSchema,
});
export type Bot = z.infer<typeof BotSchema>;

/** `content/bots.yaml`: the opponents, weakest first. */
export const BotsFileSchema = z.object({ bots: z.array(BotSchema).min(1) });
export type BotsFile = z.infer<typeof BotsFileSchema>;

export function validateBots(file: BotsFile): string[] {
  const problems: string[] = [];
  const seen = <T>(values: T[]) => new Set(values).size !== values.length;
  if (seen(file.bots.map((bot) => bot.id))) problems.push('bots: duplicate id');
  if (seen(file.bots.map((bot) => bot.level))) problems.push('bots: duplicate level');
  if (seen(file.bots.map((bot) => bot.kind))) problems.push('bots: duplicate kind');

  file.bots.forEach((bot, i) => {
    const previous = file.bots[i - 1];
    if (previous && previous.level >= bot.level) {
      problems.push(`${bot.id}: bots must go from the weakest to the strongest`);
    }
    for (const text of [bot.name, bot.instrumental, bot.character, bot.summary, bot.greeting]) {
      const found = FORBIDDEN_WORDS.find((word) => text.toLowerCase().includes(word));
      if (found) problems.push(`${bot.id}: the word "${found}" does not fit the cat's voice`);
    }
  });
  return problems;
}
