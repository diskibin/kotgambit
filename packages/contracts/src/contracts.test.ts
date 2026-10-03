import { describe, expect, it } from 'vitest';
import {
  CreateGameRequestSchema,
  GameMoveRequestSchema,
  GameMoveResponseSchema,
  NextPuzzleRequestSchema,
  PuzzleHintResponseSchema,
  PuzzleMoveResponseSchema,
  PuzzleSchema,
  ENGINE_MAX_DEPTH,
  ENGINE_MAX_MULTIPV,
  EngineAnalysisRequestSchema,
  EngineAnalysisResponseSchema,
  ReadyResponseSchema,
  ApiErrorSchema,
  AuthResponseSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  VerifyEmailRequestSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
} from './index.js';

const USER = {
  id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
  email: 'cat@example.com',
  displayName: null,
  emailVerified: false,
  accessory: 'none',
};

describe('RegisterRequestSchema', () => {
  it('normalizes the email to lower case', () => {
    const parsed = RegisterRequestSchema.parse({
      email: 'Cat@Example.COM',
      password: 'longenough',
    });
    expect(parsed.email).toBe('cat@example.com');
  });

  it('rejects a bad email, a short password and an empty name', () => {
    expect(RegisterRequestSchema.safeParse({ email: 'nope', password: 'longenough' }).success).toBe(
      false,
    );
    expect(
      RegisterRequestSchema.safeParse({ email: 'a@example.com', password: 'short' }).success,
    ).toBe(false);
    expect(
      RegisterRequestSchema.safeParse({
        email: 'a@example.com',
        password: 'longenough',
        displayName: '  ',
      }).success,
    ).toBe(false);
  });

  it('caps the password length', () => {
    const password = 'x'.repeat(129);
    expect(RegisterRequestSchema.safeParse({ email: 'a@example.com', password }).success).toBe(
      false,
    );
  });
});

describe('LoginRequestSchema', () => {
  it('does not enforce the password policy', () => {
    expect(LoginRequestSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(
      true,
    );
  });

  it('requires a password', () => {
    expect(LoginRequestSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(
      false,
    );
  });
});

describe('AuthResponseSchema', () => {
  it('accepts a valid response', () => {
    expect(
      AuthResponseSchema.safeParse({ accessToken: 't', expiresIn: 900, user: USER }).success,
    ).toBe(true);
  });

  it('rejects a non-positive lifetime and a bad user id', () => {
    expect(
      AuthResponseSchema.safeParse({ accessToken: 't', expiresIn: 0, user: USER }).success,
    ).toBe(false);
    expect(
      AuthResponseSchema.safeParse({ accessToken: 't', expiresIn: 900, user: { ...USER, id: '1' } })
        .success,
    ).toBe(false);
  });
});

describe('password reset schemas', () => {
  it('normalizes the email of a reset request', () => {
    expect(ForgotPasswordRequestSchema.parse({ email: 'Cat@Example.com' }).email).toBe(
      'cat@example.com',
    );
  });

  it('applies the password rules to the new password', () => {
    expect(ResetPasswordRequestSchema.safeParse({ token: 't', password: 'short' }).success).toBe(
      false,
    );
    expect(
      ResetPasswordRequestSchema.safeParse({ token: 't', password: 'long-enough' }).success,
    ).toBe(true);
    expect(
      ResetPasswordRequestSchema.safeParse({ token: '', password: 'long-enough' }).success,
    ).toBe(false);
  });

  it('needs a token to verify an email', () => {
    expect(VerifyEmailRequestSchema.safeParse({ token: 'abc' }).success).toBe(true);
    expect(VerifyEmailRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('ApiErrorSchema', () => {
  it('requires a code and a message', () => {
    expect(
      ApiErrorSchema.safeParse({ code: 'auth.invalid', message: 'Не получилось войти' }).success,
    ).toBe(true);
    expect(ApiErrorSchema.safeParse({ code: 'auth.invalid' }).success).toBe(false);
  });
});

describe('HealthResponseSchema', () => {
  it('accepts only ok', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok' }).success).toBe(true);
    expect(HealthResponseSchema.safeParse({ status: 'down' }).success).toBe(false);
  });
});

describe('engine schemas', () => {
  const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('defaults to one line and rejects a search past the caps', () => {
    expect(EngineAnalysisRequestSchema.parse({ fen: FEN, depth: 10 }).multipv).toBe(1);
    expect(
      EngineAnalysisRequestSchema.safeParse({ fen: FEN, depth: ENGINE_MAX_DEPTH + 1 }).success,
    ).toBe(false);
    expect(
      EngineAnalysisRequestSchema.safeParse({ fen: FEN, depth: 5, multipv: ENGINE_MAX_MULTIPV + 1 })
        .success,
    ).toBe(false);
    expect(EngineAnalysisRequestSchema.safeParse({ fen: '', depth: 5 }).success).toBe(false);
  });

  it('describes an analysis with a centipawn and a mate line', () => {
    const parsed = EngineAnalysisResponseSchema.safeParse({
      bestMove: 'e2e4',
      lines: [
        { multipv: 1, depth: 12, score: { kind: 'cp', value: 34 }, pv: ['e2e4', 'e7e5'] },
        { multipv: 2, depth: 12, score: { kind: 'mate', value: -2 }, pv: ['d2d4'] },
      ],
      timedOut: false,
      cached: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('allows no move for a finished game but not a malformed one', () => {
    const base = { lines: [], timedOut: false, cached: false };
    expect(EngineAnalysisResponseSchema.safeParse({ ...base, bestMove: null }).success).toBe(true);
    expect(EngineAnalysisResponseSchema.safeParse({ ...base, bestMove: 'e2' }).success).toBe(false);
  });

  it('reports no engine as null on the ready response', () => {
    expect(ReadyResponseSchema.safeParse({ status: 'ok', engine: null }).success).toBe(true);
  });
});

describe('puzzle schemas', () => {
  it('defaults to the rating mode and asks for a theme in the theme mode', () => {
    expect(NextPuzzleRequestSchema.parse({}).mode).toBe('rating');
    expect(NextPuzzleRequestSchema.safeParse({ localDate: '2026-10-02' }).success).toBe(true);
    expect(NextPuzzleRequestSchema.safeParse({ localDate: 'today' }).success).toBe(false);
    expect(NextPuzzleRequestSchema.safeParse({ mode: 'theme' }).success).toBe(false);
    expect(NextPuzzleRequestSchema.parse({ mode: 'theme', theme: 'fork' }).theme).toBe('fork');
    expect(NextPuzzleRequestSchema.safeParse({ mode: 'nonsense' }).success).toBe(false);
    expect(NextPuzzleRequestSchema.safeParse({ mode: 'theme', theme: 'a b' }).success).toBe(false);
  });

  it('describes a puzzle without its solution', () => {
    const puzzle = {
      attemptId: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
      puzzleId: '005Bm',
      fen: '4rk2/p1q5/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 b - - 0 43',
      lastMove: 'c7f7',
      solver: 'w',
      rating: 1434,
      themes: [],
    };
    expect(PuzzleSchema.safeParse(puzzle).success).toBe(true);
    expect(Object.keys(PuzzleSchema.parse({ ...puzzle, moves: ['a1a2'] }))).not.toContain('moves');
  });

  it('tells the three outcomes of a move apart', () => {
    expect(PuzzleMoveResponseSchema.safeParse({ result: 'illegal' }).success).toBe(true);
    expect(
      PuzzleMoveResponseSchema.safeParse({ result: 'wrong', mistakes: 1, summary: null }).success,
    ).toBe(true);
    expect(
      PuzzleMoveResponseSchema.safeParse({
        result: 'correct',
        reply: 'b2b1',
        solved: false,
        summary: null,
      }).success,
    ).toBe(true);
    expect(PuzzleMoveResponseSchema.safeParse({ result: 'wrong', mistakes: 0 }).success).toBe(
      false,
    );
  });

  it('has a different payload for each hint level', () => {
    expect(PuzzleHintResponseSchema.safeParse({ level: 1, square: 'e6' }).success).toBe(true);
    expect(PuzzleHintResponseSchema.safeParse({ level: 2, themes: [] }).success).toBe(true);
    expect(
      PuzzleHintResponseSchema.safeParse({ level: 3, move: 'e6e7', summary: null }).success,
    ).toBe(true);
    expect(PuzzleHintResponseSchema.safeParse({ level: 1, move: 'e6e7' }).success).toBe(false);
    expect(PuzzleHintResponseSchema.safeParse({ level: 4 }).success).toBe(false);
  });
});

describe('game schemas', () => {
  it('turns the learning mode on by default', () => {
    expect(CreateGameRequestSchema.parse({ botId: 'alisa', color: 'random' }).learning).toBe(true);
  });

  it('refuses an unknown color', () => {
    expect(CreateGameRequestSchema.safeParse({ botId: 'alisa', color: 'red' }).success).toBe(false);
  });

  it('tells an illegal move apart from an accepted one', () => {
    expect(GameMoveResponseSchema.parse({ result: 'illegal' })).toEqual({ result: 'illegal' });
    expect(GameMoveResponseSchema.safeParse({ result: 'ok' }).success).toBe(false);
  });

  it('takes a promotion in the move', () => {
    expect(GameMoveRequestSchema.safeParse({ move: 'e7e8q' }).success).toBe(true);
    expect(GameMoveRequestSchema.safeParse({ move: 'e7e8k' }).success).toBe(false);
  });
});
