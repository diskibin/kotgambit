import { applyMove, isValidFen, legalMoves } from '@kotgambit/chess-core';
import type { Lesson, Step } from './schema.js';

export interface ContentIssue {
  /** Where the problem is, such as `steps[2].answers[0]`. */
  path: string;
  message: string;
}

// The cat never says a position or an answer is wrong in those words, see PLAN.md 6.5 and 14.2
const FORBIDDEN_WORDS = ['неверно', 'неправильно'];

function strings(
  value: unknown,
  path: string,
  out: { path: string; text: string }[] = [],
): { path: string; text: string }[] {
  if (typeof value === 'string') out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((item, i) => strings(item, `${path}[${i}]`, out));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) strings(item, `${path}.${key}`, out);
  }
  return out;
}

function checkFen(fen: string, path: string, issues: ContentIssue[]): boolean {
  if (isValidFen(fen)) return true;
  issues.push({ path, message: `not a legal position: ${fen}` });
  return false;
}

function checkStep(step: Step, base: string, issues: ContentIssue[]): void {
  switch (step.type) {
    case 'text':
      if (step.board) checkFen(step.board.fen, `${base}.board.fen`, issues);
      break;
    case 'demo': {
      let fen = step.fen;
      if (!checkFen(fen, `${base}.fen`, issues)) break;
      step.moves.forEach((uci, i) => {
        const result = applyMove(fen, uci);
        if (result.ok) fen = result.fen;
        else issues.push({ path: `${base}.moves[${i}]`, message: `illegal move ${uci}` });
      });
      break;
    }
    case 'move': {
      if (!checkFen(step.fen, `${base}.fen`, issues)) break;
      const legal = new Set(legalMoves(step.fen).map((m) => m.uci));
      step.answers.forEach((uci, i) => {
        if (!legal.has(uci)) {
          issues.push({ path: `${base}.answers[${i}]`, message: `illegal move ${uci}` });
        }
      });
      if (new Set(step.answers).size !== step.answers.length) {
        issues.push({ path: `${base}.answers`, message: 'duplicate answers' });
      }
      break;
    }
    case 'quiz': {
      if (step.board) checkFen(step.board.fen, `${base}.board.fen`, issues);
      const correct = step.options.filter((option) => option.correct).length;
      if (correct !== 1) {
        issues.push({
          path: `${base}.options`,
          message: `exactly one option must be correct, found ${correct}`,
        });
      }
      break;
    }
    case 'find-squares': {
      if (!checkFen(step.fen, `${base}.fen`, issues)) break;
      if (new Set(step.squares).size !== step.squares.length) {
        issues.push({ path: `${base}.squares`, message: 'duplicate squares' });
      }
      if (step.movesOf) {
        const targets = new Set(
          legalMoves(step.fen)
            .filter((m) => m.from === step.movesOf)
            .map((m) => m.to),
        );
        const given = new Set(step.squares);
        const same = targets.size === given.size && [...targets].every((sq) => given.has(sq));
        if (!same) {
          issues.push({
            path: `${base}.squares`,
            message: `squares differ from the moves of ${step.movesOf}: expected ${[...targets].sort().join(' ')}`,
          });
        }
      }
      break;
    }
  }
}

/** Everything the schema cannot say: legality of positions and moves, answers, tone of the texts. */
export function validateLesson(lesson: Lesson): ContentIssue[] {
  const issues: ContentIssue[] = [];
  lesson.steps.forEach((step, index) => checkStep(step, `steps[${index}]`, issues));

  for (const { path, text } of strings(lesson.steps, 'steps')) {
    const found = FORBIDDEN_WORDS.find((word) => text.toLowerCase().includes(word));
    if (found) issues.push({ path, message: `the word "${found}" does not fit the cat's voice` });
  }
  return issues;
}

/** Checks across lessons: unique ids, and a gap-free order inside every track. */
export function validateCatalog(lessons: readonly Lesson[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const ids = new Set<string>();
  for (const lesson of lessons) {
    if (ids.has(lesson.id)) issues.push({ path: lesson.id, message: 'duplicate lesson id' });
    ids.add(lesson.id);
  }

  const ordersByTrack = new Map<string, number[]>();
  for (const lesson of lessons) {
    ordersByTrack.set(lesson.track, [...(ordersByTrack.get(lesson.track) ?? []), lesson.order]);
  }
  for (const [track, found] of ordersByTrack) {
    const orders = found.sort((a, b) => a - b);
    if (!orders.every((order, index) => order === index + 1)) {
      issues.push({
        path: track,
        message: `chapter numbers must go 1, 2, 3...: found ${orders.join(', ')}`,
      });
    }
  }
  return issues;
}
