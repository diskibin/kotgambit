import { boardThemes } from './theme';
import type { Scheme } from './ThemeProvider';

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
