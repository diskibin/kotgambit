const SECONDS_IN_MINUTE = 60;

/** 45 seconds as "0:45", the way a countdown on a button is written. */
export function formatClock(seconds: number): string {
  const rest = String(seconds % SECONDS_IN_MINUTE).padStart(2, '0');
  return `${Math.floor(seconds / SECONDS_IN_MINUTE)}:${rest}`;
}
