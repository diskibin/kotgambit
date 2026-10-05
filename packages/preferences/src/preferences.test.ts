import { describe, expect, it } from 'vitest';
import {
  BOARD_THEMES,
  DEFAULT_PREFERENCES,
  deserializePreferences,
  parsePreferences,
  PIECE_SETS,
  serializePreferences,
} from './index.js';

describe('parsePreferences', () => {
  it('gives the defaults of the design for nothing', () => {
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('text')).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toMatchObject({
      theme: 'system',
      boardTheme: 'gambit',
      pieceSet: 'gambit',
      coordinates: true,
    });
  });

  it('keeps what is right and replaces only what is wrong', () => {
    expect(
      parsePreferences({
        theme: 'dark',
        boardTheme: 'castle',
        coordinates: false,
        reduceMotion: 'yes',
      }),
    ).toEqual({ ...DEFAULT_PREFERENCES, theme: 'dark', coordinates: false });
  });

  it('knows the four boards of the design', () => {
    expect(BOARD_THEMES).toEqual(['gambit', 'wood', 'contrast', 'mint']);
    for (const boardTheme of BOARD_THEMES) {
      expect(parsePreferences({ boardTheme }).boardTheme).toBe(boardTheme);
    }
  });
});

describe('the sets of pieces', () => {
  it('are the own set of the cat and three open ones, the own set is the default', () => {
    expect(PIECE_SETS).toEqual(['gambit', 'classic', 'warm', 'lines']);
    expect(DEFAULT_PREFERENCES.pieceSet).toBe('gambit');
    for (const pieceSet of PIECE_SETS) {
      expect(parsePreferences({ pieceSet }).pieceSet).toBe(pieceSet);
    }
  });

  it('fall back to the own set for a name that is not known or a save of an older version', () => {
    expect(parsePreferences({ pieceSet: 'staunton' }).pieceSet).toBe('gambit');
    expect(parsePreferences({ theme: 'dark' }).pieceSet).toBe('gambit');
  });
});

describe('keeping and reading', () => {
  it('gives back what was kept', () => {
    const chosen = {
      ...DEFAULT_PREFERENCES,
      theme: 'light' as const,
      boardTheme: 'wood' as const,
      pieceSet: 'lines' as const,
      vibration: false,
    };
    expect(deserializePreferences(serializePreferences(chosen))).toEqual(chosen);
  });

  it('does not stop on damaged text or on nothing', () => {
    expect(deserializePreferences('{not json')).toEqual(DEFAULT_PREFERENCES);
    expect(deserializePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(deserializePreferences('')).toEqual(DEFAULT_PREFERENCES);
  });
});
