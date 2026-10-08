import { z } from 'zod';

const SQUARE = /^[a-h][1-8]$/;
const UCI = /^[a-h][1-8][a-h][1-8][nbrq]?$/;

export const SquareSchema = z.string().regex(SQUARE);
export const UciSchema = z.string().regex(UCI);

export const ArrowSchema = z.object({
  from: SquareSchema,
  to: SquareSchema,
  color: z.enum(['sky', 'sun', 'mint', 'brand']),
});
export type Arrow = z.infer<typeof ArrowSchema>;

/** A position shown next to a step: `fen` is checked with chess.js by the validator, not by the schema. */
export const BoardSchema = z.object({
  fen: z.string().min(1),
  orientation: z.enum(['w', 'b']).default('w'),
  /** The design allows at most two arrows at once. */
  arrows: z.array(ArrowSchema).max(2).default([]),
  /** Caption under the board, such as "Слон b5 шахует короля e8". */
  caption: z.string().min(1).optional(),
});
export type Board = z.infer<typeof BoardSchema>;

const text = z.string().min(1);

/** Theory without a task: a short text, optionally with a numbered list and a board. */
export const TextStepSchema = z.object({
  type: z.literal('text'),
  title: text,
  body: text,
  pointsTitle: text.optional(),
  points: z.array(text).max(5).default([]),
  board: BoardSchema.optional(),
  /** The cat's closing remark, "Запомни: …". */
  remember: text.optional(),
});

/** The cat plays the moves on the board, the learner only watches. */
export const DemoStepSchema = z.object({
  type: z.literal('demo'),
  title: text,
  body: text,
  fen: z.string().min(1),
  orientation: z.enum(['w', 'b']).default('w'),
  moves: z.array(UciSchema).min(1).max(8),
});

/** The learner makes one move. Every move in `answers` counts as correct. */
export const MoveStepSchema = z.object({
  type: z.literal('move'),
  title: text,
  prompt: text,
  fen: z.string().min(1),
  orientation: z.enum(['w', 'b']).default('w'),
  answers: z.array(UciSchema).min(1),
  /** Level 1 says which piece, level 2 the idea, level 3 shows the first move and needs no text. */
  hints: z.object({ piece: text, idea: text }),
  success: text,
  oops: text,
  successArrows: z.array(ArrowSchema).max(2).default([]),
});

export const QuizStepSchema = z.object({
  type: z.literal('quiz'),
  question: text,
  board: BoardSchema.optional(),
  options: z
    .array(z.object({ text, correct: z.boolean(), explanation: text }))
    .min(2)
    .max(4),
});

/** The learner marks squares on the board. */
export const FindSquaresStepSchema = z.object({
  type: z.literal('find-squares'),
  title: text,
  prompt: text,
  fen: z.string().min(1),
  orientation: z.enum(['w', 'b']).default('w'),
  squares: z.array(SquareSchema).min(1).max(16),
  /** When set, the validator checks that `squares` are exactly the squares this piece can move to. */
  movesOf: SquareSchema.optional(),
  success: text,
  oops: text,
  hint: text,
});

export const StepSchema = z.discriminatedUnion('type', [
  TextStepSchema,
  DemoStepSchema,
  MoveStepSchema,
  QuizStepSchema,
  FindSquaresStepSchema,
]);
export type Step = z.infer<typeof StepSchema>;
export type StepType = Step['type'];

export const PIECES = ['p', 'n', 'b', 'r', 'q', 'k'] as const;
export type Piece = (typeof PIECES)[number];

// The order of the sections on the path. New sections go in between, the chapters of a section are numbered from 1
export const TRACKS = [
  'basics',
  'practice',
  'openings',
  'tactics',
  'middlegame',
  'strategy',
  'mates',
  'endgame',
  'games',
] as const;
export type Track = (typeof TRACKS)[number];

const MIN_STEPS = 3;
const MAX_STEPS = 12;
const MAX_MINUTES = 30;

export const LessonSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  track: z.enum(TRACKS),
  /** Position in the track, the "Глава N" of the interface. */
  order: z.number().int().positive(),
  /** The public repository may only hold `free` lessons, content-guard enforces it. */
  access: z.enum(['free', 'premium']),
  /** The piece of the chapter, shown on its card. */
  piece: z.enum(PIECES),
  title: text,
  summary: text,
  minutes: z.number().int().min(1).max(MAX_MINUTES),
  steps: z.array(StepSchema).min(MIN_STEPS).max(MAX_STEPS),
});
export type Lesson = z.infer<typeof LessonSchema>;
export type LessonInput = z.input<typeof LessonSchema>;
