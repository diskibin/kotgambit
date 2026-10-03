import { useSyncExternalStore } from 'react';

// The breakpoints of web/screens/layout.md: the sidebar from 1024, icons only from 768, the bottom bar below
const LAPTOP = '(min-width: 1024px)';
const TABLET = '(min-width: 768px)';

export type NavLayout = 'full' | 'compact' | 'bottom';

function subscribe(onChange: () => void): () => void {
  const queries = [window.matchMedia(LAPTOP), window.matchMedia(TABLET)];
  queries.forEach((query) => query.addEventListener('change', onChange));
  return () => queries.forEach((query) => query.removeEventListener('change', onChange));
}

function read(): NavLayout {
  if (window.matchMedia(LAPTOP).matches) return 'full';
  return window.matchMedia(TABLET).matches ? 'compact' : 'bottom';
}

/**
 * Which navigation the screen is wide enough for. Read in code and not hidden with CSS, so that only one
 * navigation is in the page at a time, for screen readers too.
 */
export function useNavLayout(): NavLayout {
  return useSyncExternalStore(subscribe, read);
}
