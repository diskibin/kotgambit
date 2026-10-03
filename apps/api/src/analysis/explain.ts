import {
  applyMove,
  countMaterial,
  getPieces,
  legalMoves,
  type EngineScore,
  type PieceType,
  type Square,
} from '@kotgambit/chess-core';
import type { PositionProblem } from '@kotgambit/chess-core';

type Side = 'w' | 'b';

// Below these gaps in centipawns the position counts as even, slightly better, clearly better, winning
const EVEN_CP = 30;
const SLIGHT_CP = 100;
const CLEAR_CP = 300;
const FEW = 4;

/** "1 ход, 2 хода, 5 ходов" */
export function pluralMoves(count: number): string {
  const tens = count % 100;
  const last = count % 10;
  if (tens >= 11 && tens <= 14) return 'ходов';
  if (last === 1) return 'ход';
  if (last >= 2 && last <= FEW) return 'хода';
  return 'ходов';
}

const SIDES: Record<Side, { who: string; whoGen: string }> = {
  w: { who: 'белых', whoGen: 'белые' },
  b: { who: 'чёрных', whoGen: 'чёрные' },
};

export interface Verdict {
  leader: 'equal' | 'white' | 'black';
  headline: string;
  detail: string;
}

function materialFact(fen: string, leader: Side | null): string {
  const material = countMaterial(fen);
  if (!material) return '';
  const diff = material.w - material.b;
  if (diff === 0) return 'Материал равный.';
  const ahead: Side = diff > 0 ? 'w' : 'b';
  const note = `У ${SIDES[ahead].who} больше материала: +${Math.abs(diff)}.`;
  // When the side with more material is not the one that stands better, the fact is worth saying
  return leader !== null && leader !== ahead
    ? `${note} Но позиция у ${SIDES[leader].who} лучше.`
    : note;
}

/** Says who stands better and by how much, from the score of White and facts of the position. */
export function describeVerdict(fen: string, white: EngineScore): Verdict {
  if (white.kind === 'mate') {
    const side: Side = white.value > 0 ? 'w' : 'b';
    const moves = Math.abs(white.value);
    return {
      leader: side === 'w' ? 'white' : 'black',
      headline: `Мат в ${moves} ${pluralMoves(moves)}`,
      detail: `${CAPITAL(SIDES[side].whoGen)} ставят мат, если сыграют точно.`,
    };
  }
  const size = Math.abs(white.value);
  const side: Side = white.value > 0 ? 'w' : 'b';
  if (size < EVEN_CP) {
    return {
      leader: 'equal',
      headline: 'Примерно равно',
      detail: materialFact(fen, null),
    };
  }
  const degree =
    size < SLIGHT_CP
      ? 'небольшое преимущество'
      : size < CLEAR_CP
        ? 'заметное преимущество'
        : 'решающее преимущество';
  return {
    leader: side === 'w' ? 'white' : 'black',
    headline: `У ${SIDES[side].who} ${degree}`,
    detail: materialFact(fen, side),
  };
}

const PIECE_ACCUSATIVE: Record<PieceType, string> = {
  p: 'пешку',
  n: 'коня',
  b: 'слона',
  r: 'ладью',
  q: 'ферзя',
  k: 'короля',
};
const PIECE_NOMINATIVE: Record<PieceType, string> = {
  p: 'пешка',
  n: 'конь',
  b: 'слон',
  r: 'ладья',
  q: 'ферзь',
  k: 'король',
};

const CAPITAL = (text: string) => `${text[0]?.toUpperCase() ?? ''}${text.slice(1)}`;

/**
 * Describes a move by what it does on the board and nothing else: the engine does not know ideas, and
 * the plan says to state facts (PLAN.md 6.4). `gap` is how much worse the second best line is, in
 * percentage points of the chance of winning, when there is one.
 */
export function explainMove(fen: string, uci: string, gap: number | null): string {
  const move = legalMoves(fen).find((candidate) => candidate.uci === uci);
  if (!move) return '';
  const pieces = getPieces(fen);
  const mover = pieces.find((piece) => piece.square === move.from);
  const taken = pieces.find((piece) => piece.square === (move.to as Square));
  const parts: string[] = [];

  if (move.san.endsWith('#')) parts.push('Этот ход ставит мат.');
  else if (move.san.endsWith('+')) parts.push('Шах королю.');
  if (move.san.startsWith('O-O')) {
    parts.push('Рокировка прячет короля и вводит ладью в игру.');
  } else if (move.promotion) {
    parts.push(`Пешка превращается в ${PIECE_ACCUSATIVE[move.promotion]}.`);
  } else if (move.isCapture && mover) {
    const victim = taken ? PIECE_ACCUSATIVE[taken.type] : 'пешку';
    parts.push(`${CAPITAL(PIECE_NOMINATIVE[mover.type])} берёт ${victim}.`);
  }
  if (parts.length === 0) parts.push('Лучший ход по оценке движка.');
  if (gap !== null && gap >= 10) parts.push('Остальные ходы заметно слабее.');
  return parts.slice(0, 2).join(' ');
}

/** The moves of a line written in SAN, as far as they are legal, at most `limit` of them. */
export function lineToSan(fen: string, uciMoves: readonly string[], limit: number): string[] {
  const san: string[] = [];
  let position = fen;
  for (const uci of uciMoves.slice(0, limit)) {
    const played = applyMove(position, uci);
    if (!played.ok) break;
    san.push(played.move.san);
    position = played.fen;
  }
  return san;
}

const SIDE_NAMES: Record<Side, string> = { w: 'Белый', b: 'Чёрный' };

/** What the learner is told when a position cannot be analysed, with what to do about it. */
export function describeProblem(problem: PositionProblem): string {
  switch (problem.kind) {
    case 'no-king': {
      const side = problem.color === 'w' ? 'белых' : 'чёрных';
      const example = problem.color === 'w' ? 'e1' : 'e8';
      return `У ${side} нет короля. Поставь ${problem.color === 'w' ? 'белого' : 'чёрного'} короля, например на ${example}, и анализ заработает.`;
    }
    case 'many-kings':
      return `${SIDE_NAMES[problem.color]} король может быть только один. Убери лишнего.`;
    case 'pawn-on-edge':
      return `Пешка на ${problem.square} стоит на первой или последней горизонтали. Пешки там не бывает, убери её или передвинь.`;
    case 'kings-touch':
      return 'Короли не могут стоять рядом. Отодвинь один из них.';
    case 'too-many-pieces':
      return `У ${problem.color === 'w' ? 'белых' : 'чёрных'} слишком много фигур или пешек. Убери лишние.`;
    case 'side-not-to-move-in-check':
      return 'Король стороны, которая не ходит, под шахом. Так не бывает: смени очередь хода или передвинь фигуры.';
    case 'malformed':
      return 'Не получилось прочитать позицию. Проверь FEN: ряды, чей ход и фигуры.';
    case 'illegal':
      return 'Такая позиция невозможна. Проверь рокировки и взятие на проходе.';
  }
}
