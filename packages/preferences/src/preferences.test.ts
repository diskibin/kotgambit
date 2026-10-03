import { describe, expect, it } from 'vitest';
import {
  BOARD_THEMES,
  DEFAULT_PREFERENCES,
  deserializePreferences,
  parsePreferences,
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

describe('keeping and reading', () => {
  it('gives back what was kept', () => {
    const chosen = {
      ...DEFAULT_PREFERENCES,
      theme: 'light' as const,
      boardTheme: 'wood' as const,
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
