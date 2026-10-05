import {
  deserializePreferences,
  serializePreferences,
  type Preferences,
} from '@kotgambit/preferences';
import type { AppStore } from '../../app/store';

const KEY = 'kotgambit.preferences';

/** What was chosen on this device. Nothing here is private, and nothing is a reason to fail: storage may be shut. */
export function loadPreferences(): Preferences {
  try {
    return deserializePreferences(window.localStorage.getItem(KEY));
  } catch {
    // A private window or blocked site data throws on any access
    return deserializePreferences(null);
  }
}

function currentPreferences(store: AppStore): Preferences {
  const state = store.getState();
  return {
    theme: state.theme.preference,
    boardTheme: state.ui.boardTheme,
    pieceSet: state.ui.pieceSet,
    coordinates: state.ui.coordinates,
    reduceMotion: state.ui.reduceMotion,
    // The vibration is the phone's, the site has no switch for it
    vibration: true,
  };
}

/** Keeps the choices after every change of them, not after every action of the app. */
export function persistPreferences(store: AppStore): () => void {
  let last = serializePreferences(currentPreferences(store));
  return store.subscribe(() => {
    const next = serializePreferences(currentPreferences(store));
    if (next === last) return;
    last = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Not kept this time: the choice still works until the page is closed
    }
  });
}
