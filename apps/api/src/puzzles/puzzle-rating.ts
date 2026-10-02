export const START_RATING = 1000;
const MIN_RATING = 100;
const MAX_RATING = 3000;
/** The scale of Elo: 400 points of difference make the stronger side ten times as likely to win. */
const ELO_SCALE = 400;
/** A new player's rating moves fast until it has found its level. */
const NEW_PLAYER_K = 32;
const SETTLED_K = 16;
const NEW_PLAYER_ATTEMPTS = 30;

/**
 * How an attempt ended, as the rating sees it. Solving with a hint of level one or two counts for half:
 * the learner needed a nudge but found the move themselves. A mistake or the move shown by the last
 * hint counts as a miss.
 */
export type AttemptOutcome = 'clean' | 'helped' | 'failed';

const SCORE: Record<AttemptOutcome, number> = { clean: 1, helped: 0.5, failed: 0 };

export function expectedScore(player: number, puzzle: number): number {
  return 1 / (1 + 10 ** ((puzzle - player) / ELO_SCALE));
}

/** A simplified Elo update with the puzzle as the opponent. The rating of the puzzle itself never moves. */
export function nextRating(
  player: number,
  puzzle: number,
  outcome: AttemptOutcome,
  ratedAttempts: number,
): number {
  const k = ratedAttempts < NEW_PLAYER_ATTEMPTS ? NEW_PLAYER_K : SETTLED_K;
  const next = player + k * (SCORE[outcome] - expectedScore(player, puzzle));
  return Math.min(MAX_RATING, Math.max(MIN_RATING, next));
}

/** The outcome of an attempt that has just finished or failed, from what happened during it. */
export function outcomeOf(mistakes: number, hintLevel: number): AttemptOutcome {
  if (mistakes > 0 || hintLevel >= 3) return 'failed';
  return hintLevel > 0 ? 'helped' : 'clean';
}
