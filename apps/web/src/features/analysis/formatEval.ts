import type { PositionEvalValue } from '@kotgambit/contracts';
import type { TFunction } from 'i18next';

const CENTIPAWNS_IN_PAWN = 100;
// A real minus sign is easier to tell from a hyphen in a row of numbers
const MINUS = '−';

/**
 * A position's evaluation as chess players write it, from White's side: +1.5 is a pawn and a half ahead for White,
 * -0.4 is a little ahead for Black, #3 is a mate in three moves for White.
 */
export function formatEval(value: PositionEvalValue, t: TFunction): string {
  if ('over' in value) return t(`review.eval.over.${value.over}`);
  if ('mate' in value) return `${value.mate < 0 ? MINUS : ''}#${Math.abs(value.mate)}`;
  const pawns = Math.abs(value.cp) / CENTIPAWNS_IN_PAWN;
  const sign = value.cp > 0 ? '+' : value.cp < 0 ? MINUS : '';
  return `${sign}${pawns.toFixed(1)}`;
}
