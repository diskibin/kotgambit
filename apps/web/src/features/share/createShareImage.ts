import type { Accessory, Mood } from '@kotgambit/mascot';
import { CARD_SIZE, drawShareCard, type ShareCardSpec, type ShareTheme } from './drawCard';
import { mascotSvg } from './mascotSvg';

const CAT_PIXELS = 760;

/** The tokens of the page as they are now, so that a dark page gives a dark card. */
function readTheme(): ShareTheme {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    bg: token('--color-bg'),
    surface: token('--color-surface'),
    edge: token('--color-edge'),
    brand: token('--color-brand'),
    brandTint: token('--color-brand-tint'),
    text: token('--color-text'),
    text2: token('--color-text-2'),
    onBrand: token('--color-on-brand'),
    headingFont: token('--font-heading'),
    bodyFont: token('--font-body'),
  };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The cat could not be drawn'));
    image.src = source;
  });
}

/** A canvas draws with a font only after the browser has loaded it, which it does lazily. */
async function loadFonts(theme: ShareTheme): Promise<void> {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(`700 80px ${theme.headingFont}`),
    document.fonts.load(`600 36px ${theme.bodyFont}`),
    document.fonts.load(`700 34px ${theme.bodyFont}`),
  ]);
}

export interface ShareImageOptions {
  spec: ShareCardSpec;
  mood: Mood;
  accessory: Accessory;
  dark: boolean;
}

/** The card as a PNG. Everything is drawn here on the device, nothing is sent anywhere. */
export async function createShareImage({
  spec,
  mood,
  accessory,
  dark,
}: ShareImageOptions): Promise<Blob> {
  const theme = readTheme();
  await loadFonts(theme);
  const svg = mascotSvg({ mood, accessory, dark, size: CAT_PIXELS });
  const cat = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('A canvas is not available');
  drawShareCard(ctx, spec, theme, cat);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The card could not be saved'))),
      'image/png',
    );
  });
}
