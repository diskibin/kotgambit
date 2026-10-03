import { STARTING_FEN } from '@kotgambit/chess-core';
import { describe, expect, it } from 'vitest';
import {
  canCastle,
  editorReducer,
  emptyEditorState,
  fromFen,
  initialEditorState,
  toFen,
  type EditorAction,
  type EditorState,
} from './index.js';

const run = (actions: EditorAction[], from: EditorState = emptyEditorState()) =>
  actions.reduce(editorReducer, from);

const piece = (color: 'w' | 'b', type: 'k' | 'q' | 'r' | 'p') => ({
  kind: 'piece' as const,
  piece: { color, type },
});

describe('toFen and fromFen', () => {
  it('writes the initial position as the standard FEN with no counters', () => {
    expect(toFen(initialEditorState())).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(toFen(initialEditorState())).toBe(STARTING_FEN);
  });

  it('reads a FEN and writes it back', () => {
    const fen = 'r3k2r/pp3ppp/8/8/8/8/PP3PPP/R3K2R b Kq - 0 1';
    expect(toFen(fromFen(fen) as EditorState)).toBe(fen);
  });

  it('reads a position that cannot happen, so that the editor can show it', () => {
    const state = fromFen('8/8/8/8/8/8/8/4K3 w') as EditorState;
    expect(state.pieces).toEqual({ e1: { color: 'w', type: 'k' } });
    expect(toFen(state)).toBe('8/8/8/8/8/8/8/4K3 w - - 0 1');
  });

  it('is null for something that is not a FEN', () => {
    expect(fromFen('hello')).toBeNull();
    expect(fromFen('8/8/8/8/8/8/8/8 x')).toBeNull();
  });
});

describe('castling', () => {
  it('only writes the rights that the pieces allow', () => {
    // Ticked all four, but the black rook on h8 is not there and the white king has left e1
    const state = fromFen('r3k3/8/8/8/8/8/8/R2K3R w KQkq - 0 1') as EditorState;
    expect(canCastle(state, 'bQ')).toBe(true);
    expect(canCastle(state, 'bK')).toBe(false);
    expect(canCastle(state, 'wK')).toBe(false);
    expect(toFen(state)).toBe('r3k3/8/8/8/8/8/8/R2K3R w q - 0 1');
  });

  it('toggles a right', () => {
    const state = run([{ type: 'castling/toggled', right: 'wK' }]);
    expect(state.castling.wK).toBe(true);
    expect(run([{ type: 'castling/toggled', right: 'wK' }], state).castling.wK).toBe(false);
  });
});

describe('editorReducer', () => {
  it('puts the chosen piece on the pressed square', () => {
    const state = run([
      { type: 'tool/chosen', tool: piece('w', 'k') },
      { type: 'square/pressed', square: 'e1' },
    ]);
    expect(state.pieces).toEqual({ e1: { color: 'w', type: 'k' } });
  });

  it('does nothing when no tool is chosen', () => {
    const state = run([{ type: 'square/pressed', square: 'e1' }]);
    expect(state.pieces).toEqual({});
  });

  it('replaces a piece with another, and takes the same piece off when pressed again', () => {
    const state = run([
      { type: 'tool/chosen', tool: piece('w', 'q') },
      { type: 'square/pressed', square: 'd1' },
      { type: 'tool/chosen', tool: piece('b', 'r') },
      { type: 'square/pressed', square: 'd1' },
    ]);
    expect(state.pieces.d1).toEqual({ color: 'b', type: 'r' });
    expect(run([{ type: 'square/pressed', square: 'd1' }], state).pieces).toEqual({});
  });

  it('wipes a square with the eraser', () => {
    const state = run(
      [
        { type: 'tool/chosen', tool: { kind: 'eraser' } },
        { type: 'square/pressed', square: 'e2' },
      ],
      initialEditorState(),
    );
    expect(state.pieces.e2).toBeUndefined();
    expect(Object.keys(state.pieces)).toHaveLength(31);
  });

  it('clears the board and goes back to the initial position, keeping the side and the tool', () => {
    const flipped = run(
      [
        { type: 'orientation/flipped' },
        { type: 'tool/chosen', tool: piece('b', 'p') },
        { type: 'board/cleared' },
      ],
      initialEditorState(),
    );
    expect(flipped.pieces).toEqual({});
    expect(flipped.castling).toEqual({ wK: false, wQ: false, bK: false, bQ: false });
    const back = run([{ type: 'board/reset' }], flipped);
    expect(toFen(back)).toBe(STARTING_FEN);
    expect(back).toMatchObject({ orientation: 'b', tool: piece('b', 'p') });
  });

  it('sets whose turn it is and turns the board over', () => {
    const state = run([{ type: 'turn/set', turn: 'b' }, { type: 'orientation/flipped' }]);
    expect(toFen(state)).toBe('8/8/8/8/8/8/8/8 b - - 0 1');
    expect(state.orientation).toBe('b');
  });

  it('loads a pasted FEN and keeps the state when it is not one', () => {
    const state = run([{ type: 'fen/loaded', fen: '4k3/8/8/8/8/8/8/4K3 b' }]);
    expect(state.turn).toBe('b');
    expect(Object.keys(state.pieces).sort()).toEqual(['e1', 'e8']);
    expect(run([{ type: 'fen/loaded', fen: 'oops' }], state)).toBe(state);
  });
});
