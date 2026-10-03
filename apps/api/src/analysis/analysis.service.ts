import {
  getStatus,
  type GameStatus,
  outlook,
  positionProblem,
  turn,
  whiteScore,
  winPercent,
  type EngineScore,
} from '@kotgambit/chess-core';
import { ANALYSIS_LINE_MOVES, type PositionAnalysis } from '@kotgambit/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { Priority } from '../engine/engine-pool.js';
import { EngineService } from '../engine/engine.service.js';
import { describePositionProblem } from '@kotgambit/coach';
import { describeVerdict, explainMove, lineToSan } from './explain.js';

/** A position the learner built has no move counters, an engine and chess.js need them. */
export function normalizeFen(fen: string): string {
  const fields = fen.trim().split(/\s+/);
  return [
    fields[0],
    fields[1],
    fields[2] ?? '-',
    fields[3] ?? '-',
    fields[4] ?? '0',
    fields[5] ?? '1',
  ].join(' ');
}

// Deep enough to find the tactics a learner builds a position around, shallow enough to answer in seconds
const ANALYSIS_DEPTH = 14;
const ANALYSIS_LINES = 3;
// A game that is over stands at the end of the scale
const OVER_CENTIPAWNS = 10_000;

@Injectable()
export class AnalysisService {
  constructor(private readonly engine: EngineService) {}

  async analyzePosition(rawFen: string): Promise<PositionAnalysis> {
    const problem = positionProblem(rawFen);
    if (problem) {
      const details = {
        problem: problem.kind,
        ...('color' in problem ? { color: problem.color } : {}),
        ...('square' in problem ? { square: problem.square } : {}),
      };
      throw new AppError(
        'analysis.invalid_position',
        HttpStatus.UNPROCESSABLE_ENTITY,
        details,
        describePositionProblem(problem),
      );
    }
    const fen = normalizeFen(rawFen);
    const side = turn(fen) ?? 'w';
    const status = getStatus(fen);

    if (status && status.kind !== 'playing') {
      return this.finished(fen, side, status);
    }

    const result = await this.engine.analyze({
      fen,
      depth: ANALYSIS_DEPTH,
      multipv: ANALYSIS_LINES,
      priority: Priority.Analysis,
    });
    const lines = result.lines.map((line) => ({
      score: whiteScore(line.score, side),
      uci: line.pv,
      san: lineToSan(fen, line.pv, ANALYSIS_LINE_MOVES),
    }));
    const top = lines[0];
    if (!top) throw new AppError('server.unavailable', HttpStatus.SERVICE_UNAVAILABLE);

    // The gap between the best and the second line, for the mover, says whether the best move stands out
    const second = result.lines[1];
    const first = result.lines[0] as (typeof result.lines)[number];
    const gap = second ? winPercent(first.score) - winPercent(second.score) : null;
    const verdict = describeVerdict(fen, top.score);
    const bestUci = result.bestMove ?? top.uci[0];

    return {
      fen,
      turn: side,
      score: top.score,
      ...verdict,
      outlook: outlook(top.score),
      best: bestUci
        ? {
            uci: bestUci,
            san: lineToSan(fen, [bestUci], 1)[0] ?? bestUci,
            explanation: explainMove(fen, bestUci, gap),
          }
        : null,
      lines,
      depth: first.depth,
    };
  }

  private finished(fen: string, side: 'w' | 'b', status: GameStatus): PositionAnalysis {
    const winner = status.kind === 'checkmate' ? status.winner : null;
    const score: EngineScore = {
      kind: 'cp',
      value: winner === 'w' ? OVER_CENTIPAWNS : winner === 'b' ? -OVER_CENTIPAWNS : 0,
    };
    const stalemate = status.kind === 'draw' && status.reason === 'stalemate';
    const headline = winner !== null ? 'Мат' : stalemate ? 'Пат — ничья' : 'Ничья';
    const detail =
      winner !== null
        ? `${side === 'w' ? 'Белым' : 'Чёрным'} поставлен мат.`
        : stalemate
          ? 'Ходов нет, а шаха нет, партия закончилась вничью.'
          : 'Ничья по правилам шахмат.';
    return {
      fen,
      turn: side,
      score,
      leader: winner === null ? 'equal' : winner === 'w' ? 'white' : 'black',
      headline,
      detail,
      outlook: outlook(score),
      best: null,
      lines: [],
      depth: 1,
    };
  }
}
