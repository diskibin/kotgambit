import { STARTING_FEN, playGame } from '@kotgambit/chess-core';
import { describe, expect, it } from 'vitest';
import { describeVerdict, explainMove, lineToSan, pluralMoves } from './explain.js';
import { buildReview, type PositionEval, type ReviewMove } from './review.js';

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];

describe('pluralMoves', () => {
  it('declines the word for a number of moves', () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map(pluralMoves)).toEqual([
      'ход',
      'хода',
      'хода',
      'ходов',
      'ходов',
      'ходов',
      'ход',
      'хода',
      'ходов',
    ]);
  });
});

describe('describeVerdict', () => {
  const verdict = (cp: number, fen = STARTING_FEN) =>
    describeVerdict(fen, { kind: 'cp', value: cp });

  it('calls a small score equal and says the material', () => {
    expect(verdict(10)).toEqual({
      leader: 'equal',
      headline: 'Примерно равно',
      detail: 'Материал равный.',
    });
  });

  it('grades the advantage of either side', () => {
    expect(verdict(60)).toMatchObject({
      leader: 'white',
      headline: 'У белых небольшое преимущество',
    });
    expect(verdict(-200)).toMatchObject({
      leader: 'black',
      headline: 'У чёрных заметное преимущество',
    });
    expect(verdict(700)).toMatchObject({ headline: 'У белых решающее преимущество' });
  });

  it('counts the material when one side has more', () => {
    // White has an extra queen
    const fen = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1';
    expect(verdict(900, fen).detail).toBe('У белых больше материала: +9.');
  });

  it('says it when the better side has less material', () => {
    const fen = '4k3/8/8/8/8/8/8/3QK3 b - - 0 1';
    expect(verdict(-300, fen).detail).toBe(
      'У белых больше материала: +9. Но позиция у чёрных лучше.',
    );
  });

  it('tells a forced mate with its length', () => {
    expect(describeVerdict(STARTING_FEN, { kind: 'mate', value: 3 })).toMatchObject({
      leader: 'white',
      headline: 'Мат в 3 хода',
    });
    expect(describeVerdict(STARTING_FEN, { kind: 'mate', value: -1 })).toMatchObject({
      leader: 'black',
      headline: 'Мат в 1 ход',
    });
  });
});

describe('explainMove', () => {
  it('names a capture by the pieces', () => {
    const fen = '7k/8/8/3p4/4N3/8/8/4K3 w - - 0 1';
    expect(explainMove(fen, 'e4d6', null)).toBe('Лучший ход по оценке движка.');
    const capture = '7k/8/5p2/8/4N3/8/8/4K3 w - - 0 1';
    expect(explainMove(capture, 'e4f6', null)).toBe('Конь берёт пешку.');
  });

  it('tells a check and a mate', () => {
    expect(explainMove('7k/8/6K1/8/8/8/8/1Q6 w - - 0 1', 'b1b8', null)).toBe(
      'Этот ход ставит мат.',
    );
    expect(explainMove('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8', null)).toBe('Шах королю.');
  });

  it('tells a castling and a promotion', () => {
    expect(explainMove('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1g1', null)).toBe(
      'Рокировка прячет короля и вводит ладью в игру.',
    );
    expect(explainMove('8/P3k3/8/8/8/8/8/4K3 w - - 0 1', 'a7a8q', null)).toBe(
      'Пешка превращается в ферзя.',
    );
  });

  it('says the other moves are weaker only when the gap is large', () => {
    const capture = '7k/8/5p2/8/4N3/8/8/4K3 w - - 0 1';
    expect(explainMove(capture, 'e4f6', 12)).toBe(
      'Конь берёт пешку. Остальные ходы заметно слабее.',
    );
    expect(explainMove(capture, 'e4f6', 3)).toBe('Конь берёт пешку.');
  });
});

describe('lineToSan', () => {
  it('writes the moves of a line and stops at the limit or at a move that is not legal', () => {
    expect(lineToSan(STARTING_FEN, ['e2e4', 'e7e5', 'g1f3'], 2)).toEqual(['e4', 'e5']);
    expect(lineToSan(STARTING_FEN, ['e2e4', 'e2e4', 'g1f3'], 3)).toEqual(['e4']);
  });
});

describe('buildReview', () => {
  const played = playGame(FOOLS_MATE);
  if (!played) throw new Error('fixture');
  const fens = [STARTING_FEN];
  for (let i = 1; i <= FOOLS_MATE.length; i += 1) {
    fens.push((playGame(FOOLS_MATE.slice(0, i)) as { fen: string }).fen);
  }
  const moves: ReviewMove[] = played.moves.map(({ uci, san }) => ({ uci, san }));

  const position = (
    index: number,
    turn: 'w' | 'b',
    score: PositionEval['score'],
    bestUci: string | null,
    ending: PositionEval['ending'] = null,
  ): PositionEval => ({ fen: fens[index] as string, turn, score, bestUci, ending });

  // White opens with two weak moves and gets mated, Black plays what the engine wants
  const positions: PositionEval[] = [
    position(0, 'w', { kind: 'cp', value: 20 }, 'e2e4'),
    position(1, 'b', { kind: 'cp', value: 150 }, 'e7e5'),
    position(2, 'w', { kind: 'cp', value: -140 }, 'e2e4'),
    position(3, 'b', { kind: 'mate', value: 1 }, 'd8h4'),
    position(4, 'w', null, null, 'checkmate'),
  ];

  it('judges every half-move and counts the learner’s', () => {
    const review = buildReview(moves, positions, 'w');
    expect(review.qualities).toEqual(['mistake', 'best', 'blunder', 'best']);
    expect(review.counts).toEqual({ best: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 1 });
  });

  it('draws the chances of White from the start to the mate', () => {
    const review = buildReview(moves, positions, 'w');
    expect(review.chances).toHaveLength(5);
    expect(review.chances[0]).toBeGreaterThan(50);
    expect(review.chances.at(-1)).toBe(0);
  });

  it('rates the side that played the engine’s moves higher', () => {
    const review = buildReview(moves, positions, 'w');
    expect(review.accuracy.bot).toBeGreaterThan(review.accuracy.player ?? 100);
    expect(review.accuracy.bot).toBeGreaterThan(90);
  });

  it('points at the worst moves of the learner in the order they were played', () => {
    const { keyMoments } = buildReview(moves, positions, 'w');
    expect(keyMoments.map((m) => [m.ply, m.kind, m.played.san])).toEqual([
      [1, 'mistake', 'f3'],
      [3, 'blunder', 'g4'],
    ]);
    expect(keyMoments[1]).toMatchObject({
      moveNumber: 2,
      color: 'w',
      better: { uci: 'e2e4', san: 'e4' },
    });
    expect(keyMoments[1]?.explanation).toBe('После g4 у соперника мат в 1 ход. Лучше было e4.');
    expect(keyMoments[0]?.explanation).toMatch(/^Шансы упали на \d+ пунктов\. Лучше было e4\.$/);
  });

  it('praises a move that raised the chances much, and only a move that was not a mistake', () => {
    // Black (the learner) climbs from an even position to a winning one with good moves
    const ups: PositionEval[] = [
      position(0, 'w', { kind: 'cp', value: 0 }, 'f2f3'),
      position(1, 'b', { kind: 'cp', value: 10 }, 'e7e5'),
      position(2, 'w', { kind: 'cp', value: -200 }, 'g2g4'),
      position(3, 'b', { kind: 'cp', value: 300 }, 'd8h4'),
      position(4, 'w', null, null, 'checkmate'),
    ];
    const { keyMoments } = buildReview(moves, ups, 'b');
    const highlight = keyMoments.find((m) => m.kind === 'highlight');
    expect(highlight).toMatchObject({ better: null, played: { san: 'Qh4#' }, color: 'b' });
    expect(highlight?.explanation).toMatch(
      /^Qh4# — сильный ход: твои шансы выросли на \d+ пунктов\.$/,
    );
  });

  it('lists every mistake of the learner with the better move, for cards', () => {
    const { mistakes } = buildReview(moves, positions, 'w');
    expect(mistakes.map((m) => [m.ply, m.played.san, m.better.san, m.color])).toEqual([
      [1, 'f3', 'e4', 'w'],
      [3, 'g4', 'e4', 'w'],
    ]);
    expect(mistakes[0]?.fen).toBe(positions[0]?.fen);
  });

  it('leaves out the mistakes of the bot', () => {
    expect(buildReview(moves, positions, 'b').mistakes).toEqual([]);
  });

  it('gives an empty review for a game without moves', () => {
    const review = buildReview([], [position(0, 'w', { kind: 'cp', value: 0 }, 'e2e4')], 'w');
    expect(review).toMatchObject({
      accuracy: { player: null, bot: null },
      qualities: [],
      keyMoments: [],
    });
    expect(review.chances).toEqual([50]);
  });

  it('refuses positions that do not fit the moves', () => {
    expect(() => buildReview(moves, positions.slice(1), 'w')).toThrow('one position more');
  });
});
