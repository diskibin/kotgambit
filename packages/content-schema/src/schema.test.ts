import { describe, expect, it } from 'vitest';
import {
  BotsFileSchema,
  LICHESS_PUZZLE_THEMES,
  LessonSchema,
  PuzzleThemesSchema,
  STOCKFISH_MIN_ELO,
  StepSchema,
  validateBots,
  validateCatalog,
  validateLesson,
  validatePuzzleThemes,
  type Lesson,
} from './index.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// A lone knight on g1 can go to f3, h3 and e2
const KNIGHT_ONLY = '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1';

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return LessonSchema.parse({
    id: 'basics-knight',
    track: 'basics',
    order: 1,
    access: 'free',
    piece: 'n',
    title: 'Как ходит конь',
    summary: 'Буква Г',
    minutes: 5,
    steps: [
      { type: 'text', title: 'Привет', body: 'Конь ходит буквой Г.' },
      {
        type: 'move',
        title: 'Твой ход',
        prompt: 'Сходи конём',
        fen: KNIGHT_ONLY,
        answers: ['g1f3', 'g1h3'],
        hints: { piece: 'Конь', idea: 'Буква Г' },
        success: 'Отлично!',
        oops: 'Попробуем ещё раз.',
      },
      { type: 'demo', title: 'Смотри', body: 'Конь прыгает.', fen: KNIGHT_ONLY, moves: ['g1f3'] },
    ],
    ...overrides,
  });
}

describe('LessonSchema', () => {
  it('fills in the defaults', () => {
    const parsed = lesson();
    const move = parsed.steps[1];
    expect(move?.type === 'move' && move.orientation).toBe('w');
    expect(move?.type === 'move' && move.successArrows).toEqual([]);
  });

  it('rejects an unknown step type, a bad square and too few steps', () => {
    expect(StepSchema.safeParse({ type: 'dance' }).success).toBe(false);
    expect(
      StepSchema.safeParse({
        type: 'find-squares',
        title: 't',
        prompt: 'p',
        fen: START,
        squares: ['z9'],
        success: 's',
        oops: 'o',
        hint: 'h',
      }).success,
    ).toBe(false);
    expect(
      LessonSchema.safeParse({ ...lesson(), steps: [{ type: 'text', title: 'a', body: 'b' }] })
        .success,
    ).toBe(false);
  });

  it('allows at most two arrows on a board', () => {
    const arrow = { from: 'a1', to: 'a2', color: 'sky' };
    const board = { fen: START, arrows: [arrow, arrow, arrow] };
    expect(StepSchema.safeParse({ type: 'text', title: 't', body: 'b', board }).success).toBe(
      false,
    );
  });
});

describe('validateLesson', () => {
  it('accepts a correct lesson', () => {
    expect(validateLesson(lesson())).toEqual([]);
  });

  it('finds an illegal answer', () => {
    const bad = lesson();
    const move = bad.steps[1];
    if (move?.type === 'move') move.answers = ['g1g5'];
    expect(validateLesson(bad)).toEqual([
      { path: 'steps[1].answers[0]', message: 'illegal move g1g5' },
    ]);
  });

  it('finds an illegal position', () => {
    const bad = lesson();
    const demo = bad.steps[2];
    if (demo?.type === 'demo') demo.fen = '8/8/8/8/8/8/8/8 w - - 0 1';
    expect(validateLesson(bad)[0]).toMatchObject({ path: 'steps[2].fen' });
  });

  it('finds a demo whose moves are not playable in order', () => {
    const bad = lesson();
    const demo = bad.steps[2];
    if (demo?.type === 'demo') demo.moves = ['g1f3', 'g1f3'];
    expect(validateLesson(bad)).toEqual([
      { path: 'steps[2].moves[1]', message: 'illegal move g1f3' },
    ]);
  });

  it('wants exactly one correct quiz option', () => {
    const bad = lesson();
    bad.steps.push({
      type: 'quiz',
      question: 'Кто ходит буквой Г?',
      options: [
        { text: 'Конь', correct: true, explanation: 'Да' },
        { text: 'Слон', correct: true, explanation: 'Нет' },
      ],
    });
    expect(validateLesson(bad)).toEqual([
      { path: 'steps[3].options', message: 'exactly one option must be correct, found 2' },
    ]);
  });

  it('checks that the squares to find are the moves of the piece', () => {
    const bad = lesson();
    bad.steps.push({
      type: 'find-squares',
      title: 'Клетки',
      prompt: 'Куда ходит конь?',
      fen: KNIGHT_ONLY,
      orientation: 'w',
      movesOf: 'g1',
      squares: ['f3', 'h3', 'g5'],
      success: 'Да',
      oops: 'Ещё раз',
      hint: 'Буква Г',
    });
    expect(validateLesson(bad)[0]?.message).toContain('expected e2 f3 h3');
  });

  it('keeps wrong-answer shaming out of the texts', () => {
    const bad = lesson();
    const move = bad.steps[1];
    if (move?.type === 'move') move.oops = 'Это неправильно!';
    const [issue] = validateLesson(bad);
    expect(issue?.path).toBe('steps[1].oops');
    expect(issue?.message).toContain('неправильно');
  });
});

describe('validateCatalog', () => {
  it('accepts consecutive chapters', () => {
    expect(validateCatalog([lesson(), lesson({ id: 'basics-rook', order: 2 })])).toEqual([]);
  });

  it('finds duplicate ids and gaps in the numbering', () => {
    const issues = validateCatalog([lesson(), lesson({ order: 3 })]);
    expect(issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(['duplicate lesson id', expect.stringContaining('1, 3')]),
    );
  });
});

describe('puzzle themes', () => {
  const full = () =>
    PuzzleThemesSchema.parse({
      themes: Object.fromEntries(
        LICHESS_PUZZLE_THEMES.map((key) => [key, { title: `Тема ${key}` }]),
      ),
    });

  it('accepts a dictionary that names every known theme', () => {
    expect(validatePuzzleThemes(full())).toEqual([]);
  });

  it('shows a theme as visible unless it is marked hidden', () => {
    const themes = PuzzleThemesSchema.parse({
      themes: { fork: { title: 'Вилка' }, short: { title: 'Короткая', hidden: true } },
    }).themes;
    expect(themes['fork']?.hidden).toBe(false);
    expect(themes['short']?.hidden).toBe(true);
  });

  it('reports a theme without a Russian name', () => {
    const rest = Object.fromEntries(
      Object.entries(full().themes).filter(([key]) => key !== 'fork'),
    );
    expect(validatePuzzleThemes({ themes: rest })).toEqual(['fork: no Russian name']);
  });

  it('keeps the cat from saying a puzzle is wrong', () => {
    const file = full();
    file.themes['pin'] = { title: 'Связка, а ход неверно', hidden: false };
    expect(validatePuzzleThemes(file)).toEqual([expect.stringContaining('pin: the word "неверно')]);
  });

  it('rejects an empty title and a key with odd characters', () => {
    expect(PuzzleThemesSchema.safeParse({ themes: { fork: { title: '' } } }).success).toBe(false);
    expect(PuzzleThemesSchema.safeParse({ themes: { 'for k': { title: 'x' } } }).success).toBe(
      false,
    );
  });
});

describe('bots', () => {
  const strength = { movetimeMs: 300, candidates: 1, mistakeChance: 0 };
  const bot = (id: string, level: number, kind: string, extra: object = {}) => ({
    id,
    kind,
    name: 'Бот',
    instrumental: 'Ботом',
    gender: 'm',
    level,
    character: 'Играет.',
    summary: 'Играет',
    greeting: 'Привет!',
    strength: { elo: 1500, ...strength },
    ...extra,
  });
  const file = (...bots: object[]) => BotsFileSchema.parse({ bots });

  it('accepts bots that go from the weakest to the strongest', () => {
    expect(validateBots(file(bot('a', 1, 'mouse'), bot('b', 2, 'owl')))).toEqual([]);
  });

  it('wants either a skill level or an Elo, not both and not neither', () => {
    const both = { strength: { elo: 1500, skillLevel: 3, ...strength } };
    const neither = { strength };
    expect(BotsFileSchema.safeParse({ bots: [bot('a', 1, 'mouse', both)] }).success).toBe(false);
    expect(BotsFileSchema.safeParse({ bots: [bot('a', 1, 'mouse', neither)] }).success).toBe(false);
  });

  it('rejects an Elo below what Stockfish accepts', () => {
    const weak = { strength: { elo: STOCKFISH_MIN_ELO - 1, ...strength } };
    expect(BotsFileSchema.safeParse({ bots: [bot('a', 1, 'mouse', weak)] }).success).toBe(false);
  });

  it('wants several candidates from a bot that makes mistakes', () => {
    const lonely = { strength: { elo: 1500, ...strength, mistakeChance: 0.3 } };
    expect(BotsFileSchema.safeParse({ bots: [bot('a', 1, 'mouse', lonely)] }).success).toBe(false);
  });

  it('reports repeated ids, levels and kinds and a wrong order', () => {
    const problems = validateBots(file(bot('a', 2, 'mouse'), bot('a', 2, 'mouse')));
    expect(problems).toEqual(
      expect.arrayContaining([
        'bots: duplicate id',
        'bots: duplicate level',
        'bots: duplicate kind',
        'a: bots must go from the weakest to the strongest',
      ]),
    );
  });

  it('keeps the harsh words out of the texts', () => {
    const problems = validateBots(file(bot('a', 1, 'mouse', { greeting: 'Это неверно!' })));
    expect(problems).toHaveLength(1);
  });
});
