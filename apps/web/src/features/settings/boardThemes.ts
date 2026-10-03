import type { BoardTheme } from '@kotgambit/preferences';
import type { CSSProperties } from 'react';

// The four boards of the design (shared/tokens/tokens.json, "board"). The first is the board of the cat that
// tokens.css already draws, in both color schemes, so it needs no override.
export const BOARD_COLORS: Record<
  Exclude<BoardTheme, 'gambit'>,
  { light: string; dark: string; coordOnLight: string; coordOnDark: string }
> = {
  wood: { light: '#F3E3C3', dark: '#B98556', coordOnLight: '#8A5A2F', coordOnDark: '#FBF1DC' },
  contrast: { light: '#FFFFFF', dark: '#2F3C73', coordOnLight: '#2F3C73', coordOnDark: '#FFFFFF' },
  mint: { light: '#E6F7EE', dark: '#2E8A62', coordOnLight: '#237050', coordOnDark: '#E6F7EE' },
};

/** The custom properties that recolor the squares and the letters of the board, none for the board of the cat. */
export function boardThemeStyle(theme: BoardTheme): CSSProperties | undefined {
  if (theme === 'gambit') return undefined;
  const colors = BOARD_COLORS[theme];
  return {
    '--color-board-a': colors.dark,
    '--color-board-b': colors.light,
    '--board-coord-on-light': colors.coordOnLight,
    '--board-coord-on-dark': colors.coordOnDark,
  } as CSSProperties;
}
