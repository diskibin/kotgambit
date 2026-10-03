import type { Accessory } from '@kotgambit/mascot';
import { useContext, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import { api } from '../../app/api';

const NO_UNSUBSCRIBE = () => undefined;
const subscribeNothing = () => NO_UNSUBSCRIBE;

type AnyState = Parameters<ReturnType<typeof api.endpoints.me.select>>[0];

/**
 * What the cat wears for this learner, the same everywhere in the product. A cat drawn without the store, such as
 * in its own tests, or for a visitor who has not signed in, is the plain one.
 */
export function useWornAccessory(): Accessory {
  const context = useContext(ReactReduxContext);
  const store = context?.store as
    { getState: () => AnyState; subscribe: (listener: () => void) => () => void } | undefined;
  return useSyncExternalStore(store ? store.subscribe : subscribeNothing, () =>
    store ? (api.endpoints.me.select()(store.getState()).data?.accessory ?? 'none') : 'none',
  );
}
