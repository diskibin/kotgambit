import {
  applyMove,
  classifyMove,
  gameAccuracy,
  whiteScore,
  winPercent,
  type EngineScore,
  type MoveQuality,
} from '@kotgambit/chess-core';
import type { GameReview, KeyMoment } from '@kotgambit/contracts';
import { pluralMoves } from './explain.js';

type Side = 'w' | 'b';

/** What the engine said about one position of the game, the position before a move or the last one. */
export interface PositionEval {
  fen: string;
  turn: Side;
  /** The side to move's score, `null` when the game is over in this position. */
  score: EngineScore | null;
  bestUci: string | null;
  ending: 'checkmate' | 'draw' | null;
}

export interface ReviewMove {
  uci: string;
  san: string;
}

// How many of the learner's worst moves the review points at, and the smallest gain worth praising
const MAX_WORST = 2;
const MIN_HIGHLIGHT_GAIN = 8;
const ROUND = 10;
// A card per mistake, but not a hundred of them out of one long game
const MAX_MISTAKES = 20;

/** The chance that White wins in a position, in percent. */
function whiteChance(position: PositionEval): number {
  if (position.ending === 'checkmate') return position.turn === 'w' ? 0 : 100;
  if (position.ending === 'draw' || position.score === null) return 50;
  return winPercent(whiteScore(position.score, position.turn));
}

/** The SAN of a move that the engine proposed for a position, which is legal by construction. */
function sanOf(fen: string, uci: string): string {
  const played = applyMove(fen, uci);
  return played.ok ? played.move.san : uci;
}

const forSide = (white: number, side: Side) => (side === 'w' ? white : 100 - white);
const rounded = (value: number) => Math.round(value * ROUND) / ROUND;

function describeLoss(
  move: ReviewMove,
  betterSan: string,
  drop: number,
  mateAgainst: number | null,
): string {
  if (mateAgainst !== null) {
    return `После ${move.san} у соперника мат в ${mateAgainst} ${pluralMoves(mateAgainst)}. Лучше было ${betterSan}.`;
  }
  return `Шансы упали на ${Math.round(drop)} пунктов. Лучше было ${betterSan}.`;
}

/**
 * Turns the engine's look at every position of a finished game into the review: the judgement of every
 * half-move, the chances graph, the accuracy of both sides and the moments worth a card. `positions`
 * holds one entry per position, so one more than there are moves. Pure, so that it is tested on
 * invented numbers and needs no engine.
 */
export function buildReview(
  moves: readonly ReviewMove[],
  positions: readonly PositionEval[],
  learner: Side,
): GameReview {
  if (positions.length !== moves.length + 1) {
    throw new Error('A review needs one position more than there are moves');
  }
  const chances = positions.map(whiteChance);
  const drops: Record<Side, number[]> = { w: [], b: [] };
  const qualities: MoveQuality[] = [];
  const counts = { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  const losses: { ply: number; drop: number; quality: MoveQuality }[] = [];
  const mistakes: GameReview['mistakes'] = [];

  moves.forEach((move, index) => {
    const before = positions[index] as PositionEval;
    const side = before.turn;
    const chanceBefore = forSide(chances[index] as number, side);
    const chanceAfter = forSide(chances[index + 1] as number, side);
    const drop = Math.max(0, chanceBefore - chanceAfter);
    const quality = classifyMove(chanceBefore, chanceAfter, move.uci === before.bestUci);
    qualities.push(quality);
    drops[side].push(drop);
    if (side === learner) {
      counts[quality] += 1;
      if (quality === 'mistake' || quality === 'blunder') {
        losses.push({ ply: index + 1, drop, quality });
        if (before.bestUci) {
          mistakes.push({
            ply: index + 1,
            fen: before.fen,
            color: side,
            played: { uci: move.uci, san: move.san },
            better: { uci: before.bestUci, san: sanOf(before.fen, before.bestUci) },
          });
        }
      }
    }
  });

  const moment = (ply: number, kind: KeyMoment['kind'], explanation: string): KeyMoment => {
    const move = moves[ply - 1] as ReviewMove;
    const before = positions[ply - 1] as PositionEval;
    const better = kind === 'highlight' ? null : before.bestUci;
    return {
      ply,
      moveNumber: Math.ceil(ply / 2),
      color: before.turn,
      kind,
      played: { uci: move.uci, san: move.san },
      better: better ? { uci: better, san: sanOf(before.fen, better) } : null,
      fen: before.fen,
      explanation,
    };
  };

  const worst = losses
    .sort((a, b) => b.drop - a.drop)
    .slice(0, MAX_WORST)
    .map((loss) => {
      const after = positions[loss.ply] as PositionEval;
      const mover = (positions[loss.ply - 1] as PositionEval).turn;
      // A mate against the mover is a score of the opponent, who is to move next
      const mateAgainst =
        after.score?.kind === 'mate' && after.score.value > 0 && after.turn !== mover
          ? after.score.value
          : null;
      const best = (positions[loss.ply - 1] as PositionEval).bestUci;
      const betterSan = best ? sanOf((positions[loss.ply - 1] as PositionEval).fen, best) : '';
      return moment(
        loss.ply,
        loss.quality === 'blunder' ? 'blunder' : 'mistake',
        describeLoss(moves[loss.ply - 1] as ReviewMove, betterSan, loss.drop, mateAgainst),
      );
    });

  // The learner's move after which their chances stand much higher than before their previous move
  let highlight: { ply: number; gain: number } | null = null;
  moves.forEach((_move, index) => {
    const side = (positions[index] as PositionEval).turn;
    if (side !== learner || qualities[index] === 'mistake' || qualities[index] === 'blunder')
      return;
    const previous = index >= 2 ? (chances[index - 1] as number) : (chances[0] as number);
    const gain = forSide(chances[index + 1] as number, side) - forSide(previous, side);
    if (gain >= MIN_HIGHLIGHT_GAIN && (!highlight || gain > highlight.gain)) {
      highlight = { ply: index + 1, gain };
    }
  });
  const keyMoments = [...worst];
  const picked = highlight as { ply: number; gain: number } | null;
  if (picked) {
    const san = (moves[picked.ply - 1] as ReviewMove).san;
    keyMoments.push(
      moment(
        picked.ply,
        'highlight',
        `${san} — сильный ход: твои шансы выросли на ${Math.round(picked.gain)} пунктов.`,
      ),
    );
  }
  keyMoments.sort((a, b) => a.ply - b.ply);

  const opponent: Side = learner === 'w' ? 'b' : 'w';
  return {
    accuracy: { player: gameAccuracy(drops[learner]), bot: gameAccuracy(drops[opponent]) },
    counts,
    chances: chances.map(rounded),
    qualities,
    keyMoments,
    mistakes: mistakes.slice(0, MAX_MISTAKES),
  };
}
