import { describe, expect, it } from 'vitest';
import { formatRubles, percentOf, shortDay } from './format';

describe('the formats of the admin page', () => {
  it('says rubles for kopecks, rounded', () => {
    expect(formatRubles(0)).toBe('0 ₽');
    expect(formatRubles(29_950)).toMatch(/^300 ₽$/);
    // A narrow no-break space groups the thousands in Russian
    expect(formatRubles(199_000).replace(/\s/g, ' ')).toBe('1 990 ₽');
  });

  it('takes a percent and does not divide by zero', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(5, 0)).toBe(0);
  });

  it('shortens a day to day and month', () => {
    expect(shortDay('2026-10-06')).toBe('06.10');
  });
});
