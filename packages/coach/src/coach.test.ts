import { describe, expect, it } from 'vitest';
import { PHRASES, PUZZLE_PHRASES, PUZZLE_TITLES, createCoach, type CoachEvent } from './index.js';

const MAX_WORDS = 16;
// Words that would break the cat's voice: scolding, guilt, pressure, sarcasm
const FORBIDDEN = [
  'неверно',
  'неправильно',
  'ошибка',
  'потеря',
  'потеряешь',
  'срочно',
  'последний шанс',
  'ну конечно',
];

const allPhrases = Object.entries(PHRASES).flatMap(([key, items]) =>
  items.map((phrase) => ({ key, ...phrase })),
);

/** A random source that walks through a fixed list of values. */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe('phrases', () => {
  it('has at least three variants for every situation', () => {
    for (const [key, items] of Object.entries(PHRASES)) {
      expect(items.length, key).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every line short', () => {
    for (const { key, title, text } of allPhrases) {
      expect(text.split(/\s+/).length, `${key}: ${text}`).toBeLessThanOrEqual(MAX_WORDS);
      expect(title.split(/\s+/).length, `${key}: ${title}`).toBeLessThanOrEqual(MAX_WORDS);
    }
  });

  it('keeps scolding and pressure out of the voice', () => {
    for (const { key, title, text } of allPhrases) {
      for (const word of FORBIDDEN) {
        expect(`${title} ${text}`.toLowerCase(), `${key}: ${word}`).not.toContain(word);
      }
    }
  });

  it('has no duplicate titles inside a situation', () => {
    for (const [key, items] of Object.entries(PHRASES)) {
      expect(new Set(items.map((p) => p.title)).size, key).toBe(items.length);
    }
  });
});

describe('createCoach', () => {
  const correct = (
    over: Partial<Extract<CoachEvent, { type: 'STEP_CORRECT' }>> = {},
  ): CoachEvent => ({
    type: 'STEP_CORRECT',
    attempts: 1,
    streak: 1,
    ...over,
  });

  it('praises with a happy cat and no effect', () => {
    const message = createCoach(() => 0).message(correct());
    expect(message).toMatchObject({ mascot: 'happy', tone: 'success', effect: 'none' });
    expect(PHRASES.correct.map((p) => p.title)).toContain(message.title);
  });

  it('prefers the explanation of the step over a generic line', () => {
    const message = createCoach(() => 0).message(
      correct({ detail: 'С f3 конь смотрит на центр.' }),
    );
    expect(message.text).toBe('С f3 конь смотрит на центр.');
  });

  it('notices a streak of correct answers, but not when they needed several tries', () => {
    const coach = createCoach(() => 0);
    expect(coach.message(correct({ streak: 3 }))).toMatchObject({ mascot: 'proud' });
    expect(coach.message(correct({ streak: 3, attempts: 2 }))).toMatchObject({ mascot: 'happy' });
  });

  it('calms the learner after a mistake and shakes the card a little', () => {
    const message = createCoach(() => 0).message({ type: 'STEP_WRONG', attempts: 1 });
    expect(message).toMatchObject({ mascot: 'oops', tone: 'oops', effect: 'shake' });
  });

  it('offers a hint after repeated mistakes', () => {
    const coach = createCoach(() => 0);
    const first = coach.message({ type: 'STEP_WRONG', attempts: 1 });
    const third = coach.message({ type: 'STEP_WRONG', attempts: HINT_AFTER });
    expect(first.text).not.toMatch(/подсказ|лампочк/i);
    expect(third.text).toMatch(/подсказ|лампочк/i);
  });

  it('shows hints and demos in their own tone', () => {
    const coach = createCoach(() => 0);
    expect(coach.message({ type: 'HINT', level: 1 })).toMatchObject({
      mascot: 'hint',
      tone: 'hint',
    });
    expect(coach.message({ type: 'DEMO' })).toMatchObject({ tone: 'demo' });
  });

  it('celebrates a lesson with confetti, softly when it went badly', () => {
    const coach = createCoach(() => 0);
    expect(coach.message({ type: 'LESSON_COMPLETED', accuracy: 0.9 })).toMatchObject({
      mascot: 'cheer',
      tone: 'celebrate',
      effect: 'confetti',
    });
    expect(coach.message({ type: 'LESSON_COMPLETED', accuracy: 0.4 })).toMatchObject({
      mascot: 'happy',
      tone: 'soft',
      effect: 'confetti',
    });
  });

  it('never says the same line twice in a row', () => {
    const coach = createCoach(() => 0);
    const titles = Array.from({ length: 12 }, () => coach.message(correct()).title);
    titles.slice(1).forEach((title, index) => expect(title).not.toBe(titles[index]));
  });

  it('is deterministic for a given random source', () => {
    const run = () => {
      const coach = createCoach(sequence([0.1, 0.9, 0.5, 0.3]));
      return Array.from(
        { length: 6 },
        () => coach.message({ type: 'STEP_WRONG', attempts: 1 }).title,
      );
    };
    expect(run()).toEqual(run());
  });

  it('uses every variant over time', () => {
    // A small seeded generator stands in for Math.random
    let state = 12345;
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const coach = createCoach(random);
    const seen = new Set(Array.from({ length: 60 }, () => coach.message(correct()).title));
    expect(seen.size).toBe(PHRASES.correct.length);
  });
});

const HINT_AFTER = 2;

describe('puzzle phrases', () => {
  const texts = Object.entries(PUZZLE_PHRASES).flatMap(([key, items]) =>
    items.map((text) => ({ key, text })),
  );

  it('has at least three variants for every situation, all different', () => {
    for (const [key, items] of Object.entries(PUZZLE_PHRASES)) {
      expect(items.length, key).toBeGreaterThanOrEqual(3);
      expect(new Set(items).size, key).toBe(items.length);
    }
  });

  it('keeps every line short and free of scolding and pressure', () => {
    for (const { key, text } of texts) {
      expect(text.split(/\s+/).length, `${key}: ${text}`).toBeLessThanOrEqual(MAX_WORDS);
      for (const word of FORBIDDEN)
        expect(text.toLowerCase(), `${key}: ${word}`).not.toContain(word);
    }
  });

  it('uses the headings of the design and no red', () => {
    expect(PUZZLE_TITLES).toEqual({
      solving: 'Найди лучший ход',
      correct: 'Верно!',
      wrong: 'Не совсем',
      solution: 'Решение',
    });
  });
});

describe('puzzle messages', () => {
  const coach = () => createCoach(() => 0);

  it('invites to look for the move with a thinking cat and a plain card', () => {
    expect(coach().message({ type: 'PUZZLE_START' })).toMatchObject({
      title: 'Найди лучший ход',
      mascot: 'thinking',
      tone: 'neutral',
    });
  });

  it('praises a solved puzzle, and notices a streak', () => {
    expect(coach().message({ type: 'PUZZLE_SOLVED', streak: 1 })).toMatchObject({
      title: 'Верно!',
      mascot: 'happy',
      tone: 'success',
    });
    const streak = coach().message({ type: 'PUZZLE_SOLVED', streak: 3 });
    expect(streak).toMatchObject({ title: 'Верно!', mascot: 'proud' });
    expect(PUZZLE_PHRASES.streak).toContain(streak.text);
  });

  it('answers a wrong move calmly, with the title of the design and the oops cat', () => {
    expect(coach().message({ type: 'PUZZLE_WRONG' })).toMatchObject({
      title: 'Не совсем',
      mascot: 'oops',
      tone: 'oops',
      effect: 'none',
    });
  });

  it('numbers the hints and names the ideas on the second level', () => {
    expect(coach().message({ type: 'PUZZLE_HINT', level: 1 }).title).toBe('Подсказка 1 из 3');
    const second = coach().message({ type: 'PUZZLE_HINT', level: 2, themes: ['Вилка', 'Связка'] });
    expect(second).toMatchObject({ title: 'Подсказка 2 из 3', tone: 'hint', mascot: 'hint' });
    expect(second.text.endsWith('Вилка, Связка.')).toBe(true);
    expect(coach().message({ type: 'PUZZLE_HINT', level: 3 }).title).toBe('Подсказка 3 из 3');
  });

  it('gives a general idea when the puzzle has no theme to show', () => {
    const plain = coach().message({ type: 'PUZZLE_HINT', level: 2, themes: [] });
    expect(PUZZLE_PHRASES.hint2Plain).toContain(plain.text);
  });

  it('shows the solution with the title of the design', () => {
    expect(coach().message({ type: 'PUZZLE_SOLUTION' })).toMatchObject({
      title: 'Решение',
      tone: 'demo',
    });
  });

  it('never repeats the same line twice in a row', () => {
    const c = coach();
    const texts = Array.from({ length: 10 }, () => c.message({ type: 'PUZZLE_WRONG' }).text);
    texts.slice(1).forEach((text, index) => expect(text).not.toBe(texts[index]));
  });
});
