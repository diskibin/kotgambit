export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEMES)[number];

export const BOARD_THEMES = ['gambit', 'wood', 'contrast', 'mint'] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];

/** What the learner chose on the settings screen and keeps on the device. The server knows none of it. */
export interface Preferences {
  theme: ThemePreference;
  boardTheme: BoardTheme;
  /** The letters a to h and the numbers 1 to 8 on the edges of the board. */
  coordinates: boolean;
  /** No confetti, jumps or slides, only a soft fade, on top of what the system asks for. */
  reduceMotion: boolean;
  /** A short buzz on a good move and a soft double one on a miss. Used by the app only. */
  vibration: boolean;
}

// The defaults of the design: follow the system, the cat's board, coordinates on
export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  boardTheme: 'gambit',
  coordinates: true,
  reduceMotion: false,
  vibration: true,
};

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

/**
 * Reads what was saved, whatever it is. A value that is missing, from an older version or damaged falls back
 * to its default, so a bad save never stops the app from starting.
 */
export function parsePreferences(raw: unknown): Preferences {
  const saved = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const flag = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback;
  return {
    theme: isOneOf(THEMES, saved.theme) ? saved.theme : DEFAULT_PREFERENCES.theme,
    boardTheme: isOneOf(BOARD_THEMES, saved.boardTheme)
      ? saved.boardTheme
      : DEFAULT_PREFERENCES.boardTheme,
    coordinates: flag(saved.coordinates, DEFAULT_PREFERENCES.coordinates),
    reduceMotion: flag(saved.reduceMotion, DEFAULT_PREFERENCES.reduceMotion),
    vibration: flag(saved.vibration, DEFAULT_PREFERENCES.vibration),
  };
}

/** The text to keep, and reading it back. Never throws on what it reads. */
export const serializePreferences = (preferences: Preferences): string =>
  JSON.stringify(preferences);

export function deserializePreferences(text: string | null | undefined): Preferences {
  if (!text) return DEFAULT_PREFERENCES;
  try {
    return parsePreferences(JSON.parse(text));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
