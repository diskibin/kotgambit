import { applyMove } from '@kotgambit/chess-core';
import type { Arrow, Step } from '@kotgambit/content-schema';

type Of<T extends Step['type']> = Extract<Step, { type: T }>;

export function isCorrectMove(step: Of<'move'>, uci: string): boolean {
  return step.answers.includes(uci);
}

export function isCorrectOption(step: Of<'quiz'>, optionIndex: number): boolean {
  return step.options[optionIndex]?.correct === true;
}

/** The marked squares must be exactly the wanted ones: no more, no fewer. */
export function isCorrectSquares(step: Of<'find-squares'>, marked: readonly string[]): boolean {
  const wanted = new Set(step.squares);
  const given = new Set(marked);
  return wanted.size === given.size && [...wanted].every((square) => given.has(square));
}

export interface Hint {
  text: string;
  /** Squares the board outlines with a dashed frame. */
  squares: string[];
  arrows: Arrow[];
}

const FIRST = 0;

/**
 * Hints get more open step by step (PLAN.md 6.5): 1 says which piece, 2 gives the idea, 3 shows the move.
 * Only move steps have three levels, a find-squares step has one hint and quizzes have none.
 */
export function hintFor(step: Step, level: 1 | 2 | 3): Hint | null {
  if (step.type === 'find-squares') return { text: step.hint, squares: [], arrows: [] };
  if (step.type !== 'move') return null;

  const answer = step.answers[FIRST];
  if (!answer) return null;
  const from = answer.slice(0, 2);
  const to = answer.slice(2, 4);

  if (level === 1) return { text: step.hints.piece, squares: [from], arrows: [] };
  if (level === 2) return { text: step.hints.idea, squares: [from], arrows: [] };
  return { text: step.hints.idea, squares: [from], arrows: [{ from, to, color: 'sky' }] };
}

export const maxHintLevel = (step: Step): 0 | 1 | 3 =>
  step.type === 'move' ? 3 : step.type === 'find-squares' ? 1 : 0;

export interface DemoFrame {
  fen: string;
  /** The move that led here, for the "last move" highlight. */
  from?: string;
  to?: string;
}

/** The positions of a demo step: the start, then after each move. Stops at the first move that cannot be played. */
export function demoFrames(step: Of<'demo'>): DemoFrame[] {
  const frames: DemoFrame[] = [{ fen: step.fen }];
  let fen = step.fen;
  for (const uci of step.moves) {
    const result = applyMove(fen, uci);
    if (!result.ok) break;
    fen = result.fen;
    frames.push({ fen, from: result.move.from, to: result.move.to });
  }
  return frames;
}

export const optionKey = (index: number): string => String.fromCharCode('A'.charCodeAt(0) + index);
