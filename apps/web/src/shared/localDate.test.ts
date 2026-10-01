import { localDateKey } from './localDate';

describe('localDateKey', () => {
  it('formats a local date with leading zeros', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
});
