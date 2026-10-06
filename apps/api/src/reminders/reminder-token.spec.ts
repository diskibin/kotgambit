import { describe, expect, it } from 'vitest';
import { readUnsubscribeToken, unsubscribeToken } from './reminder-token.js';

const SECRET = 'x'.repeat(32);
const ID = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';

describe('the token of the unsubscribe link', () => {
  it('gives back the learner it was made for', () => {
    expect(readUnsubscribeToken(SECRET, unsubscribeToken(SECRET, ID))).toBe(ID);
  });

  it('is worth nothing under another secret, for another learner, or when cut or made up', () => {
    const token = unsubscribeToken(SECRET, ID);
    expect(readUnsubscribeToken('y'.repeat(32), token)).toBeNull();
    const other = '4a8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';
    expect(readUnsubscribeToken(SECRET, `${other}.${token.split('.')[1]}`)).toBeNull();
    expect(readUnsubscribeToken(SECRET, token.slice(0, -2))).toBeNull();
    expect(readUnsubscribeToken(SECRET, ID)).toBeNull();
    expect(readUnsubscribeToken(SECRET, '')).toBeNull();
    expect(readUnsubscribeToken(SECRET, `${ID}.`)).toBeNull();
  });
});
