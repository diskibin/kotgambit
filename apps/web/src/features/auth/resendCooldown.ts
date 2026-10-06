const KEY_PREFIX = 'kg.verify.resendAt.';

/** The seconds a learner waits between two emails with the link. */
export const RESEND_SECONDS = 45;

const MS_IN_SECOND = 1000;

/** When the next email may be asked for, as a moment in time, 0 if there is nothing to wait for. */
export function readResendAt(userId: string): number {
  try {
    const value = Number(localStorage.getItem(`${KEY_PREFIX}${userId}`));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Starts the wait. It is kept in the browser, not in the page: opening another page or reloading the site does
 * not make the learner wait again, and does not let them ask again sooner either.
 */
export function startResendWait(userId: string, now: number = Date.now()): number {
  const until = now + RESEND_SECONDS * MS_IN_SECOND;
  try {
    localStorage.setItem(`${KEY_PREFIX}${userId}`, String(until));
  } catch {
    // Without storage the wait lasts only while the page does, which is how it was
  }
  return until;
}
