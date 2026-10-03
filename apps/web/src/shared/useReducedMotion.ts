import { useSyncExternalStore } from 'react';
import { useUiPreferences } from '../features/settings/useUiPreferences';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True when the system asks for less motion: no auto-play, no jumping, a plain fade instead. */
export function useReducedMotion(): boolean {
  const system = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
  const chosen = useUiPreferences().reduceMotion;
  // The switch in the settings asks for the same thing as the system does
  return system || chosen;
}
