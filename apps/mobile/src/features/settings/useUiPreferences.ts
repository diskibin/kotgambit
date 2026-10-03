import { useContext, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import { initialUiState, type UiState } from './ui.slice';

const NO_UNSUBSCRIBE = () => undefined;
const subscribeNothing = () => NO_UNSUBSCRIBE;

/**
 * The choices for the theme, the board, motion and vibration. Components that may be drawn without the store,
 * such as the board in its own tests, get the defaults instead of an error.
 */
export function useUiPreferences(): UiState {
  const context = useContext(ReactReduxContext);
  const store = context?.store as
    | { getState: () => { ui: UiState }; subscribe: (listener: () => void) => () => void }
    | undefined;
  return useSyncExternalStore(
    store ? store.subscribe : subscribeNothing,
    () => store?.getState().ui ?? initialUiState,
  );
}
