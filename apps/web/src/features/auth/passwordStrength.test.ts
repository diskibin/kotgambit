import { passwordStrength } from './passwordStrength';

describe('passwordStrength', () => {
  it('is empty for an empty field', () => {
    expect(passwordStrength('')).toMatchObject({ filled: 0, label: 'weak', length: 0 });
  });

  it('shows at least one segment as soon as something is typed', () => {
    expect(passwordStrength('abc')).toMatchObject({ filled: 1, label: 'weak' });
  });

  it('calls a plain 8 letter password fair at most', () => {
    expect(passwordStrength('abcdefgh').label).toBe('weak');
    expect(passwordStrength('abcdefg1').label).toBe('fair');
  });

  it('rewards length, digits and a mix of cases', () => {
    const strength = passwordStrength('GambitCat2026!');
    expect(strength).toMatchObject({ filled: 4, label: 'good', hasDigits: true, length: 14 });
  });

  it('understands Cyrillic letters', () => {
    expect(passwordStrength('Гамбит2026').label).toBe('good');
  });
});
