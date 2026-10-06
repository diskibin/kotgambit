/** What a card says. No name and no address: it goes to people the learner picks, and further. */
export interface ShareCardSpec {
  kicker: string;
  headline: string;
  caption: string;
  /** The name of the site at the bottom, such as its address. */
  site: string;
}

/** Colors and fonts from the tokens, read from the page so that the card follows the theme. */
export interface ShareTheme {
  bg: string;
  surface: string;
  edge: string;
  brand: string;
  brandTint: string;
  text: string;
  text2: string;
  onBrand: string;
  headingFont: string;
  bodyFont: string;
}

export const CARD_SIZE = 1080;
const MARGIN = 72;
const FRAME = 8;
// The hard shadow of the "shashka" style, down and to the right
const SHADOW = 16;
const RADIUS = 48;
const CAT_SIZE = 380;
const HEADLINE_SIZE = 80;
const HEADLINE_LINE = 96;
const MAX_HEADLINE_LINES = 3;

type Measure = (text: string) => number;

/** Breaks a text into lines no wider than `width`, by words. A word wider than a line stays whole. */
export function wrapLines(text: string, width: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Keeps the lines that fit and ends the last one with an ellipsis when something was left out. */
export function limitLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = `${(kept[max - 1] ?? '').replace(/[\s.,;:!?]+$/, '')}…`;
  return kept;
}

/** Draws the card: a framed plate with a hard shadow, the cat above the words, the site at the bottom. */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  spec: ShareCardSpec,
  theme: ShareTheme,
  cat: CanvasImageSource,
): void {
  ctx.fillStyle = theme.brandTint;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  const plate = MARGIN;
  const plateSize = CARD_SIZE - MARGIN * 2 - SHADOW;
  ctx.fillStyle = theme.edge;
  ctx.beginPath();
  ctx.roundRect(plate + SHADOW, plate + SHADOW, plateSize, plateSize, RADIUS);
  ctx.fill();
  ctx.fillStyle = theme.surface;
  ctx.strokeStyle = theme.edge;
  ctx.lineWidth = FRAME;
  ctx.beginPath();
  ctx.roundRect(plate, plate, plateSize, plateSize, RADIUS);
  ctx.fill();
  ctx.stroke();

  const centre = plate + plateSize / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.drawImage(cat, centre - CAT_SIZE / 2, plate + 40, CAT_SIZE, CAT_SIZE);

  ctx.fillStyle = theme.text2;
  ctx.font = `700 34px ${theme.bodyFont}`;
  ctx.fillText(spec.kicker.toUpperCase(), centre, plate + CAT_SIZE + 96);

  ctx.fillStyle = theme.text;
  ctx.font = `700 ${HEADLINE_SIZE}px ${theme.headingFont}`;
  const textWidth = plateSize - MARGIN * 2;
  const lines = limitLines(
    wrapLines(spec.headline, textWidth, (text) => ctx.measureText(text).width),
    MAX_HEADLINE_LINES,
  );
  const top = plate + CAT_SIZE + 190;
  lines.forEach((line, index) => ctx.fillText(line, centre, top + index * HEADLINE_LINE));

  ctx.fillStyle = theme.text2;
  ctx.font = `600 36px ${theme.bodyFont}`;
  ctx.fillText(spec.caption, centre, plate + plateSize - 87);

  ctx.fillStyle = theme.brand;
  ctx.font = `700 34px ${theme.headingFont}`;
  ctx.fillText(spec.site, centre, plate + plateSize - 34);
}
