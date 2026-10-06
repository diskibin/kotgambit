const VISITOR_KEY = 'kg.visitor';
const SENT_PREFIX = 'kg.sent.';

/** Off in the tests, where a request that nobody expects is an error, and wherever the build says so. */
export function analyticsEnabled(): boolean {
  if (import.meta.env.VITE_ANALYTICS === 'off') return false;
  // A browser that asks not to be tracked is not counted, which is also what the privacy policy promises
  return navigator.doNotTrack !== '1';
}

/**
 * The random id of this browser. It is made up here and says nothing about the person; without storage
 * (a private window that blocks it) there is no id and the visit is not counted.
 */
export function visitorId(): string | null {
  try {
    const known = localStorage.getItem(VISITOR_KEY);
    if (known) return known;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/** True the first time in a browser session, so that a step done again and again counts once per visit. */
export function firstInSession(name: string): boolean {
  try {
    if (sessionStorage.getItem(`${SENT_PREFIX}${name}`)) return false;
    sessionStorage.setItem(`${SENT_PREFIX}${name}`, '1');
    return true;
  } catch {
    // Without session storage the step is sent every time, a repeat is harmless: the server counts visitors
    return true;
  }
}
