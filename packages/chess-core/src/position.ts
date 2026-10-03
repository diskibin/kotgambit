import { Chess, type Move as ChessJsMove } from 'chess.js';
import type {
  ApplyMoveResult,
  Color,
  DrawReason,
  GameStatus,
  Move,
  PieceType,
  PlacedPiece,
  Square,
  PromotionPiece,
} from './types.js';

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const UCI_PATTERN = /^([a-h][1-8])([a-h][1-8])([nbrq])?$/;

// Conventional piece values, the king is not counted
const PIECE_VALUES: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * chess.js lets a position through where the side that is not to move is in check, which could only
 * arise if the last move left its own king under attack. Engines such as Stockfish crash on it.
 */
function opponentKingIsAttacked(game: Chess): boolean {
  const mover = game.turn();
  const king = game
    .board()
    .flat()
    .find((piece) => piece?.type === 'k' && piece.color !== mover);
  return king ? game.isAttacked(king.square, mover) : false;
}

function load(fen: string): Chess | null {
  try {
    const game = new Chess(fen);
    return opponentKingIsAttacked(game) ? null : game;
  } catch {
    // chess.js reports a malformed or illegal FEN by throwing
    return null;
  }
}

function toMove(m: ChessJsMove): Move {
  const promotion = m.promotion as PromotionPiece | undefined;
  return {
    from: m.from,
    to: m.to,
    san: m.san,
    uci: `${m.from}${m.to}${promotion ?? ''}`,
    isCapture: m.isCapture(),
    ...(promotion ? { promotion } : {}),
  };
}

export function isValidFen(fen: string): boolean {
  return load(fen) !== null;
}

export function turn(fen: string): Color | null {
  return load(fen)?.turn() ?? null;
}

export function legalMoves(fen: string): Move[] {
  const game = load(fen);
  return game ? game.moves({ verbose: true }).map(toMove) : [];
}

/** Accepts either UCI (`e2e4`, `e7e8q`) or SAN (`Nf3`). */
export function applyMove(fen: string, input: string): ApplyMoveResult {
  const game = load(fen);
  if (!game) return { ok: false, reason: 'invalid-fen' };

  const uci = UCI_PATTERN.exec(input);
  try {
    const played = uci
      ? game.move({
          from: uci[1] as string,
          to: uci[2] as string,
          ...(uci[3] ? { promotion: uci[3] } : {}),
        })
      : game.move(input);
    return { ok: true, fen: game.fen(), move: toMove(played) };
  } catch {
    // chess.js throws on illegal moves instead of returning null
    return { ok: false, reason: 'illegal-move' };
  }
}

function drawReason(game: Chess): DrawReason {
  if (game.isStalemate()) return 'stalemate';
  if (game.isInsufficientMaterial()) return 'insufficient-material';
  if (game.isThreefoldRepetition()) return 'threefold-repetition';
  return 'fifty-moves';
}

function statusOf(game: Chess): GameStatus {
  if (game.isCheckmate()) return { kind: 'checkmate', winner: game.turn() === 'w' ? 'b' : 'w' };
  if (game.isDraw()) return { kind: 'draw', reason: drawReason(game) };
  return { kind: 'playing', inCheck: game.inCheck() };
}

// A bare FEN has no history, so threefold repetition only shows up in `playGame`
export function getStatus(fen: string): GameStatus | null {
  const game = load(fen);
  return game ? statusOf(game) : null;
}

export interface PlayedGame {
  fen: string;
  moves: Move[];
  status: GameStatus;
}

/**
 * Plays a game from the starting position. Returns `null` when a move is not legal at its place,
 * which for a stored game would mean corrupted data.
 */
export function playGame(uciMoves: readonly string[]): PlayedGame | null {
  const game = new Chess();
  const moves: Move[] = [];
  for (const input of uciMoves) {
    const uci = UCI_PATTERN.exec(input);
    if (!uci) return null;
    try {
      moves.push(
        toMove(
          game.move({
            from: uci[1] as string,
            to: uci[2] as string,
            ...(uci[3] ? { promotion: uci[3] } : {}),
          }),
        ),
      );
    } catch {
      return null;
    }
  }
  return { fen: game.fen(), moves, status: statusOf(game) };
}

export function countMaterial(fen: string): Record<Color, number> | null {
  const game = load(fen);
  if (!game) return null;
  const total: Record<Color, number> = { w: 0, b: 0 };
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece) total[piece.color] += PIECE_VALUES[piece.type];
    }
  }
  return total;
}

export function getPieces(fen: string): PlacedPiece[] {
  const game = load(fen);
  if (!game) return [];
  return game
    .board()
    .flat()
    .flatMap((piece) =>
      piece ? [{ square: piece.square, color: piece.color, type: piece.type }] : [],
    );
}

/** Square of the king that is in check, which is always the side to move. */
export function checkedKingSquare(fen: string): Square | null {
  const game = load(fen);
  if (!game?.inCheck()) return null;
  const side = game.turn();
  return getPieces(fen).find((p) => p.type === 'k' && p.color === side)?.square ?? null;
}
