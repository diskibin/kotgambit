import type { BotStrength } from '@kotgambit/content-schema';
import type { Analysis } from '../engine/uci-engine.js';

/**
 * The move a bot plays from an engine search. A weak bot sometimes takes one of the other lines
 * instead of the best, which is how it plays below Stockfish's own Elo floor and how it
 * makes the kind of mistakes a person would.
 */
export function pickBotMove(
  analysis: Analysis,
  strength: Pick<BotStrength, 'mistakeChance'>,
  random: () => number,
): string | null {
  const others = analysis.lines.slice(1).flatMap((line) => line.pv[0] ?? []);
  if (others.length > 0 && random() < strength.mistakeChance) {
    return others[Math.floor(random() * others.length)] ?? analysis.bestMove;
  }
  return analysis.bestMove;
}
