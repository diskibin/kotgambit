import { LessonSchema, type Lesson } from '@kotgambit/content-schema';
import { describe, expect, it } from 'vitest';
import {
  demoFrames,
  elapsedSeconds,
  hintFor,
  initialLessonSession,
  isCorrectMove,
  isCorrectOption,
  isCorrectSquares,
  lessonSessionReducer,
  maxHintLevel,
  optionKey,
  reportedAttempts,
  type LessonSession,
  type LessonSessionAction,
} from './index.js';

const KNIGHT = '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1';

const lesson: Lesson = LessonSchema.parse({
  id: 'basics-knight',
  track: 'basics',
  order: 1,
  access: 'free',
  piece: 'n',
  title: 'Конь',
  summary: 'Конь',
  minutes: 5,
  steps: [
    { type: 'text', title: 'Привет', body: 'Конь.' },
    {
      type: 'move',
      title: 'Ход',
      prompt: 'Сходи',
      fen: KNIGHT,
      answers: ['g1f3', 'g1h3'],
      hints: { piece: 'Конь', idea: 'Буква Г' },
      success: 'Да',
      oops: 'Ещё раз',
    },
    {
      type: 'find-squares',
      title: 'Клетки',
      prompt: 'Отметь',
      fen: KNIGHT,
      squares: ['f3', 'h3', 'e2'],
      success: 'Да',
      oops: 'Нет',
      hint: 'Буква Г',
    },
    {
      type: 'quiz',
      question: 'Кто?',
      options: [
        { text: 'Конь', correct: true, explanation: 'Да' },
        { text: 'Слон', correct: false, explanation: 'Нет' },
      ],
    },
    { type: 'demo', title: 'Смотри', body: 'Конь.', fen: KNIGHT, moves: ['g1f3', 'e8d8'] },
  ],
});

const run = (...actions: LessonSessionAction[]): LessonSession =>
  actions.reduce(lessonSessionReducer, initialLessonSession);

const start: LessonSessionAction = {
  type: 'lesson/started',
  lessonId: 'basics-knight',
  stepTypes: lesson.steps.map((s) => s.type),
  now: 1_000,
};
const checked = (correct: boolean): LessonSessionAction => ({ type: 'step/checked', correct });
const next = (now = 2_000): LessonSessionAction => ({ type: 'step/advanced', now });

describe('lessonSessionReducer', () => {
  it('starts at the first step with nothing tried', () => {
    expect(run(start)).toMatchObject({
      lessonId: 'basics-knight',
      index: 0,
      phase: 'working',
      attempts: [0, 0, 0, 0, 0],
    });
  });

  it('goes through text steps without counting tries', () => {
    const state = run(start, next());
    expect(state.index).toBe(1);
    expect(reportedAttempts(state)).toEqual([1, 1, 1, 1, 1]);
  });

  it('counts a clean answer as one try', () => {
    const state = run(start, next(), checked(true));
    expect(state).toMatchObject({ phase: 'correct' });
    expect(state.attempts[1]).toBe(1);
  });

  it('counts every check and goes back to trying after a wrong answer', () => {
    const wrong = run(start, next(), checked(false));
    expect(wrong.phase).toBe('wrong');
    const again = lessonSessionReducer(
      lessonSessionReducer(wrong, { type: 'step/retried' }),
      checked(true),
    );
    expect(again).toMatchObject({ phase: 'correct' });
    expect(again.attempts[1]).toBe(2);
  });

  it('does not allow a second check before retrying', () => {
    const wrong = run(start, next(), checked(false));
    expect(lessonSessionReducer(wrong, checked(true))).toBe(wrong);
  });

  it('keeps the streak for first-try answers and breaks it on a retry', () => {
    const a = run(start, next(), checked(true), next());
    expect(a.firstTryStreak).toBe(1);
    const b = lessonSessionReducer(a, checked(true));
    const c = lessonSessionReducer(b, next());
    expect(c.firstTryStreak).toBe(2);

    const d = lessonSessionReducer(c, checked(false));
    const e = lessonSessionReducer(
      lessonSessionReducer(d, { type: 'step/retried' }),
      checked(true),
    );
    expect(lessonSessionReducer(e, next()).firstTryStreak).toBe(0);
  });

  it('hands out at most three hints per step and starts over at the next step', () => {
    const state = run(
      start,
      next(),
      { type: 'hint/requested' },
      { type: 'hint/requested' },
      { type: 'hint/requested' },
      { type: 'hint/requested' },
    );
    expect(state.hintLevel).toBe(3);
    expect(lessonSessionReducer(lessonSessionReducer(state, checked(true)), next()).hintLevel).toBe(
      0,
    );
  });

  it('finishes the lesson on the last step', () => {
    let state = run(start);
    for (let i = 0; i < lesson.steps.length; i += 1) {
      const step = lesson.steps[i];
      if (step && ['move', 'quiz', 'find-squares'].includes(step.type)) {
        state = lessonSessionReducer(state, checked(true));
      }
      state = lessonSessionReducer(state, next(61_000));
    }
    expect(state.finishedAt).toBe(61_000);
    expect(state.index).toBe(lesson.steps.length - 1);
    expect(elapsedSeconds(state)).toBe(60);
    expect(reportedAttempts(state)).toEqual([1, 1, 1, 1, 1]);
  });

  it('forgets everything on exit', () => {
    expect(run(start, next(), { type: 'lesson/exited' })).toEqual(initialLessonSession);
  });

  it('reports no time for an unfinished lesson', () => {
    expect(elapsedSeconds(run(start))).toBe(0);
  });
});

describe('answers', () => {
  const [, move, squares, quiz] = lesson.steps;

  it('accepts any of the listed moves', () => {
    if (move?.type !== 'move') throw new Error('fixture');
    expect(isCorrectMove(move, 'g1f3')).toBe(true);
    expect(isCorrectMove(move, 'g1h3')).toBe(true);
    expect(isCorrectMove(move, 'e1e2')).toBe(false);
  });

  it('checks the quiz option', () => {
    if (quiz?.type !== 'quiz') throw new Error('fixture');
    expect(isCorrectOption(quiz, 0)).toBe(true);
    expect(isCorrectOption(quiz, 1)).toBe(false);
    expect(isCorrectOption(quiz, 7)).toBe(false);
  });

  it('wants exactly the right squares', () => {
    if (squares?.type !== 'find-squares') throw new Error('fixture');
    expect(isCorrectSquares(squares, ['h3', 'e2', 'f3'])).toBe(true);
    expect(isCorrectSquares(squares, ['f3', 'h3'])).toBe(false);
    expect(isCorrectSquares(squares, ['f3', 'h3', 'e2', 'g2'])).toBe(false);
  });

  it('labels the options A, B, C, D', () => {
    expect([0, 1, 2, 3].map(optionKey)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('hintFor', () => {
  const [, move, squares, quiz] = lesson.steps;

  it('names the piece, then the idea, then shows the move', () => {
    if (move?.type !== 'move') throw new Error('fixture');
    expect(hintFor(move, 1)).toEqual({ text: 'Конь', squares: ['g1'], arrows: [] });
    expect(hintFor(move, 2)?.text).toBe('Буква Г');
    expect(hintFor(move, 3)?.arrows).toEqual([{ from: 'g1', to: 'f3', color: 'sky' }]);
  });

  it('gives find-squares one hint and quizzes none', () => {
    if (squares?.type !== 'find-squares' || quiz?.type !== 'quiz') throw new Error('fixture');
    expect(hintFor(squares, 1)?.text).toBe('Буква Г');
    expect(hintFor(quiz, 1)).toBeNull();
    expect([move?.type, squares.type, quiz.type].length).toBe(3);
    expect(maxHintLevel(squares)).toBe(1);
    expect(maxHintLevel(quiz)).toBe(0);
    if (move) expect(maxHintLevel(move)).toBe(3);
  });
});

describe('demoFrames', () => {
  it('lists the start and the position after every move', () => {
    const demo = lesson.steps[4];
    if (demo?.type !== 'demo') throw new Error('fixture');
    const frames = demoFrames(demo);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual({ fen: KNIGHT });
    expect(frames[1]).toMatchObject({ from: 'g1', to: 'f3' });
    expect(frames[2]).toMatchObject({ from: 'e8', to: 'd8' });
  });

  it('stops at a move that cannot be played', () => {
    const demo = lesson.steps[4];
    if (demo?.type !== 'demo') throw new Error('fixture');
    expect(demoFrames({ ...demo, moves: ['g1f3', 'g1f3'] })).toHaveLength(2);
  });
});
