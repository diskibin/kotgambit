import { describe, expect, it } from 'vitest';
import { LessonSchema, StepSchema, validateCatalog, validateLesson, type Lesson } from './index.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// A lone knight on g1 can go to f3, h3 and e2
const KNIGHT_ONLY = '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1';

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return LessonSchema.parse({
    id: 'basics-knight',
    track: 'basics',
    order: 1,
    access: 'free',
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
