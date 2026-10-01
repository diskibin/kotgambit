import { useSyncExternalStore } from 'react';
import { useAppSelector } from '../../app/hooks';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const systemPrefersDark = () => window.matchMedia(DARK_QUERY).matches;

/** The colour scheme on screen: the user's choice, or the system one when the choice is "system". */
export function useScheme(): 'light' | 'dark' {
  const preference = useAppSelector((state) => state.theme.preference);
  const systemDark = useSyncExternalStore(subscribe, systemPrefersDark);
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}
