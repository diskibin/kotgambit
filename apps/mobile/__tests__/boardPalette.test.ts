import { boardPalette, selectionColors } from '../src/theme/board';
import { darkColors, lightColors } from '../src/theme/theme';

describe('selection of a square', () => {
  it('keeps the ring of the design in the light theme', () => {
    expect(selectionColors('light').ring).toBe('#5B4BFF');
  });

  it('is not the color of the dark squares in the dark theme', () => {
    const palette = boardPalette('gambit', 'dark', darkColors);
    expect(palette.dark).toBe('#5B4BFF');
    expect(palette.selectionRing).not.toBe(palette.dark);
    expect(palette.selectionRing).not.toBe(palette.light);
  });

  it('follows the scheme on the boards of the other themes too', () => {
    expect(boardPalette('mint', 'light', lightColors).selectionRing).toBe('#5B4BFF');
    expect(boardPalette('mint', 'dark', darkColors).selectionRing).not.toBe('#5B4BFF');
  });
});
