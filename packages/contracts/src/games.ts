import { z } from 'zod';

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][nbrq]?$/;

export const BotKindSchema = z.enum(['mouse', 'hamster', 'fox', 'owl', 'wolf', 'bear']);

/** What the learner sees of a bot. How it plays stays on the server. */
export const BotProfileSchema = z.object({
  id: z.string(),
  kind: BotKindSchema,
  name: z.string(),
  level: z.number().int().min(1).max(6),
  character: z.string(),
  greeting: z.string(),
});
export type BotProfile = z.infer<typeof BotProfileSchema>;

export const BotListSchema = z.object({ bots: z.array(BotProfileSchema) });
export type BotList = z.infer<typeof BotListSchema>;

export const CreateGameRequestSchema = z.object({
  botId: z.string().min(1),
  color: z.enum(['w', 'b', 'random']),
  /** Hints, taking a move back and the cat's remarks. A game without it is a plain game. */
  learning: z.boolean().default(true),
});
export type CreateGameRequest = z.input<typeof CreateGameRequestSchema>;

export const GameOutcomeSchema = z.enum(['win', 'loss', 'draw']);
export type GameOutcome = z.infer<typeof GameOutcomeSchema>;

export const GameEndReasonSchema = z.enum([
  'checkmate',
  'stalemate',
  'insufficient-material',
  'fifty-moves',
  'threefold-repetition',
  'resignation',
]);
export type GameEndReason = z.infer<typeof GameEndReasonSchema>;

export const GameResultSchema = z.object({
  outcome: GameOutcomeSchema,
  reason: GameEndReasonSchema,
  /** The XP this game brought, a win and a draw bring more than a loss, which still counts. */
  xp: z.number().int().nonnegative(),
});
export type GameResult = z.infer<typeof GameResultSchema>;

export const GameMoveSchema = z.object({ uci: z.string().regex(UCI_MOVE), san: z.string() });
export type GameMove = z.infer<typeof GameMoveSchema>;

export const GameSchema = z.object({
  id: z.uuid(),
  botId: z.string(),
  userColor: z.enum(['w', 'b']),
  learning: z.boolean(),
  status: z.enum(['active', 'finished']),
  fen: z.string(),
  /** Whose move it is. When it is the bot's, its answer did not come (the engine was busy) and the client asks again. */
  turn: z.enum(['w', 'b']),
  /** Every move of the game, the bot's included, so a client can show the list and replay it. */
  moves: z.array(GameMoveSchema),
  inCheck: z.boolean(),
  /** How many hints the learning mode still gives in this game. */
  hintsLeft: z.number().int().nonnegative(),
  /** Null while the game is on. */
  result: GameResultSchema.nullable(),
});
export type Game = z.infer<typeof GameSchema>;

/** The game to go back to when the app is opened again, if there is one. */
export const ActiveGameSchema = z.object({ game: GameSchema.nullable() });
export type ActiveGame = z.infer<typeof ActiveGameSchema>;

export const GameMoveRequestSchema = z.object({ move: z.string().regex(UCI_MOVE) });

export const GameMoveResponseSchema = z.discriminatedUnion('result', [
  /** The move is not legal here, the game stays as it was. */
  z.object({ result: z.literal('illegal') }),
  z.object({
    result: z.literal('ok'),
    /** The game after the learner's move and the bot's answer. */
    game: GameSchema,
    /** The bot's answer, `null` when the game is over or the engine was too busy to answer. */
    botMove: GameMoveSchema.nullable(),
  }),
]);
export type GameMoveResponse = z.infer<typeof GameMoveResponseSchema>;

export const GameHintResponseSchema = z.object({
  move: z.string().regex(UCI_MOVE),
  hintsLeft: z.number().int().nonnegative(),
});
export type GameHintResponse = z.infer<typeof GameHintResponseSchema>;
