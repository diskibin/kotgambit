import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'reminders-unsubscribe';

function signature(secret: string, userId: string): string {
  return createHmac('sha256', secret).update(`${PURPOSE}:${userId}`).digest('base64url');
}

/**
 * The token in the link of a reminder: the id of the learner and a signature of it. It has no expiry on purpose,
 * a link in an old letter must still unsubscribe. It can do one thing only: switch the reminders off.
 */
export function unsubscribeToken(secret: string, userId: string): string {
  return `${userId}.${signature(secret, userId)}`;
}

/** The learner of a token that is ours, `null` for anything else. */
export function readUnsubscribeToken(secret: string, token: string): string | null {
  const separator = token.indexOf('.');
  if (separator <= 0) return null;
  const userId = token.slice(0, separator);
  const given = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(signature(secret, userId));
  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}
