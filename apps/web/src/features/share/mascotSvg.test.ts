import { describe, expect, it } from 'vitest';
import { mascotSvg } from './mascotSvg';

const draw = (accessory: 'none' | 'crown' = 'none', dark = false) =>
  mascotSvg({ mood: 'proud', accessory, dark, size: 400 });

describe('the cat as a file', () => {
  it('is a standalone SVG that a browser can read', () => {
    const svg = draw();
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('viewBox="0 0 200 200"');
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.querySelectorAll('path, circle, ellipse, rect, g').length).toBeGreaterThan(20);
  });

  it('writes the attributes the way an SVG file does, not the way React does', () => {
    const svg = draw();
    expect(svg).toContain('stroke-width=');
    expect(svg).toContain('stroke-linecap=');
    expect(svg).not.toMatch(/strokeWidth|strokeLinecap|strokeLinejoin/);
  });

  it('wears what it is given, and has the light outline on a dark page', () => {
    expect(draw('crown').length).toBeGreaterThan(draw('none').length);
    expect(draw('none', true)).not.toBe(draw('none', false));
  });
});
