import { describe, expect, it, vi } from 'vitest';
import {
  CARD_SIZE,
  drawShareCard,
  limitLines,
  wrapLines,
  type ShareCardSpec,
  type ShareTheme,
} from './drawCard';

// One unit of width per letter keeps the arithmetic of the tests readable
const letters = (text: string) => text.length;

describe('wrapping the words of a card', () => {
  it('breaks by words and keeps every line within the width', () => {
    expect(wrapLines('Задача дня 7 дней подряд', 12, letters)).toEqual([
      'Задача дня 7',
      'дней подряд',
    ]);
  });

  it('keeps a word that is wider than a line whole, on a line of its own', () => {
    expect(wrapLines('Победа Сверхдлинноеслово конь', 10, letters)).toEqual([
      'Победа',
      'Сверхдлинноеслово',
      'конь',
    ]);
  });

  it('gives nothing for an empty text, and ignores the extra spaces', () => {
    expect(wrapLines('', 10, letters)).toEqual([]);
    expect(wrapLines('  раз   два ', 20, letters)).toEqual(['раз два']);
  });

  it('cuts to the lines that fit and ends the last of them with an ellipsis', () => {
    expect(limitLines(['а', 'б'], 3)).toEqual(['а', 'б']);
    expect(limitLines(['раз,', 'два,', 'три'], 2)).toEqual(['раз,', 'два…']);
  });
});

const THEME: ShareTheme = {
  bg: '#bg',
  surface: '#surface',
  edge: '#edge',
  brand: '#brand',
  brandTint: '#tint',
  text: '#text',
  text2: '#text2',
  onBrand: '#onbrand',
  headingFont: 'Unbounded',
  bodyFont: 'Onest',
};

const SPEC: ShareCardSpec = {
  kicker: 'Серия занятий',
  headline: '7 дней подряд',
  caption: 'Занимаюсь шахматами каждый день',
  site: 'kotgambit.ru',
};

/** A canvas that writes down what it was asked to draw. */
function recordingContext() {
  const texts: { text: string; fill: string; font: string }[] = [];
  const state = { fillStyle: '', font: '' };
  const ctx = {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(value: string) {
      state.fillStyle = value;
    },
    get font() {
      return state.font;
    },
    set font(value: string) {
      state.font = value;
    },
    strokeStyle: '',
    lineWidth: 0,
    textAlign: '',
    textBaseline: '',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    measureText: (text: string) => ({ width: text.length * 20 }),
    fillText: (text: string) => texts.push({ text, fill: state.fillStyle, font: state.font }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, raw: ctx, texts };
}

describe('drawing a card', () => {
  it('puts the cat, the words and the site on the plate, in the colors of the theme', () => {
    const { ctx, raw, texts } = recordingContext();
    const cat = {} as CanvasImageSource;
    drawShareCard(ctx, SPEC, THEME, cat);

    expect(raw.fillRect).toHaveBeenCalledWith(0, 0, CARD_SIZE, CARD_SIZE);
    expect(raw.drawImage).toHaveBeenCalledTimes(1);
    expect(raw.drawImage.mock.calls[0]?.[0]).toBe(cat);

    expect(texts.map((entry) => entry.text)).toEqual([
      'СЕРИЯ ЗАНЯТИЙ',
      '7 дней подряд',
      'Занимаюсь шахматами каждый день',
      'kotgambit.ru',
    ]);
    expect(texts[1]).toMatchObject({ fill: '#text', font: expect.stringContaining('Unbounded') });
    expect(texts[2]?.font).toContain('Onest');
    expect(texts[3]?.fill).toBe('#brand');
  });

  it('breaks a long headline into lines and cuts it after three', () => {
    const { ctx, texts } = recordingContext();
    // A line of the plate holds under 40 letters at 20 units a letter, so every word below starts a new line
    const headline = `${'а'.repeat(30)} ${'б'.repeat(30)} ${'в'.repeat(30)} ${'г'.repeat(30)}`;
    drawShareCard(ctx, { ...SPEC, headline }, THEME, {} as CanvasImageSource);
    const lines = texts.filter((entry) => entry.fill === '#text').map((entry) => entry.text);
    expect(lines).toHaveLength(3);
    expect(lines[2]?.endsWith('…')).toBe(true);
  });
});
