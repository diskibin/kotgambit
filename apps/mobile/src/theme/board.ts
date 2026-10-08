import { boardThemes } from './theme';
import type { BoardTheme } from '@kotgambit/preferences';
import type { Colors, Scheme } from './ThemeProvider';

const { highlight, gambit } = boardThemes;

export const boardHighlight = {
  selectedRing: highlight['selected-ring'],
  selectedFill: highlight['selected-fill'],
  moveDot: highlight['move-dot'],
  captureCorners: highlight['capture-corners'],
  lastMove: highlight['last-move'],
  checkGlow: highlight['check-glow'],
  hintDashed: highlight['hint-dashed'],
} as const;

/** The design only defines coordinate colors for the light theme; the dark values are a choice, see the web tokens. */
export function coordColors(scheme: Scheme): { onLight: string; onDark: string } {
  return scheme === 'light'
    ? { onLight: gambit['coord-on-light'], onDark: gambit['coord-on-dark'] }
    : { onLight: '#14111F', onDark: gambit['coord-on-dark'] };
}

/** The dark squares of the dark theme are the brand color, so the brand ring of the design is not seen on them. */
export function selectionColors(scheme: Scheme): { ring: string; fill: string } {
  return scheme === 'light'
    ? { ring: boardHighlight.selectedRing, fill: boardHighlight.selectedFill }
    : { ring: gambit['coord-on-dark'], fill: 'rgba(244,241,255,0.18)' };
}

export interface BoardPalette {
  light: string;
  dark: string;
  coordOnLight: string;
  coordOnDark: string;
  selectionRing: string;
  selectionFill: string;
}

/** The squares and the letters of the board the learner chose. The board of the cat follows the color scheme. */
export function boardPalette(theme: BoardTheme, scheme: Scheme, colors: Colors): BoardPalette {
  const selection = selectionColors(scheme);
  if (theme === 'gambit') {
    const coords = coordColors(scheme);
    return {
      light: colors.boardB,
      dark: colors.boardA,
      coordOnLight: coords.onLight,
      coordOnDark: coords.onDark,
      selectionRing: selection.ring,
      selectionFill: selection.fill,
    };
  }
  const chosen = boardThemes[theme];
  return {
    light: chosen.light,
    dark: chosen.dark,
    coordOnLight: chosen['coord-on-light'],
    coordOnDark: chosen['coord-on-dark'],
    selectionRing: selection.ring,
    selectionFill: selection.fill,
  };
}
