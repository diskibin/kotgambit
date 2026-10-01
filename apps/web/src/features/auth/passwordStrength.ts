export interface Strength {
  /** How many of the four meter segments are filled, 0 for an empty field. */
  filled: number;
  label: 'weak' | 'fair' | 'good';
  length: number;
  hasDigits: boolean;
}

const LONG_PASSWORD = 12;
const MIN_PASSWORD = 8;
const GOOD_SCORE = 3;

/**
 * A rough guide for the person typing, not a security rule: the server only demands 8 characters.
 * One point each for length, a long length, digits, and a mix of cases or symbols.
 */
export function passwordStrength(password: string): Strength {
  const hasDigits = /\d/.test(password);
  const mixed =
    (/[a-zа-яё]/.test(password) && /[A-ZА-ЯЁ]/.test(password)) || /[^\p{L}\d]/u.test(password);
  const score = [
    password.length >= MIN_PASSWORD,
    password.length >= LONG_PASSWORD,
    hasDigits,
    mixed,
  ].filter(Boolean).length;

  return {
    filled: password.length === 0 ? 0 : Math.max(score, 1),
    label: score >= GOOD_SCORE ? 'good' : score === 2 ? 'fair' : 'weak',
    length: password.length,
    hasDigits,
  };
}
