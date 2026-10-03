import {
  deserializePreferences,
  serializePreferences,
  type Preferences,
} from '@kotgambit/preferences';
import * as Keychain from 'react-native-keychain';
import type { AppStore } from '../../app/store';
import { preferencesLoaded } from './ui.slice';

// Keychain is already the one native store of the app, so the choices ride on it instead of a second native
// module. They are not secret, and a failure to read or write them is never a reason to stop the app.
const SERVICE = 'kotgambit.preferences';
const USERNAME = 'preferences';

export async function loadPreferences(): Promise<Preferences> {
  try {
    const stored = await Keychain.getGenericPassword({ service: SERVICE });
    return deserializePreferences(stored ? stored.password : null);
  } catch {
    return deserializePreferences(null);
  }
}

function currentPreferences(store: AppStore): Preferences {
  const { theme, boardTheme, coordinates, reduceMotion, vibration } = store.getState().ui;
  return { theme, boardTheme, coordinates, reduceMotion, vibration };
}

/** Reads the saved choices into the store, then keeps them after every change of them. */
export async function restorePreferences(store: AppStore): Promise<() => void> {
  store.dispatch(preferencesLoaded(await loadPreferences()));
  let last = serializePreferences(currentPreferences(store));
  return store.subscribe(() => {
    const next = serializePreferences(currentPreferences(store));
    if (next === last) return;
    last = next;
    void Keychain.setGenericPassword(USERNAME, next, { service: SERVICE }).catch(() => {
      // Not kept this time: the choice still works until the app is closed
    });
  });
}
