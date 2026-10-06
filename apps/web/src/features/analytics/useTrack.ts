import type { AnalyticsEventName } from '@kotgambit/contracts';
import { useCallback } from 'react';
import { useTrackEventMutation } from '../../app/api';
import { analyticsEnabled, firstInSession, visitorId } from './tracker';

/** Reports a step of the visitor. Never waits, never fails loudly: counting must not get in the way. */
export function useTrack(): (
  name: AnalyticsEventName,
  options?: { oncePerSession?: boolean },
) => void {
  const [send] = useTrackEventMutation();
  return useCallback(
    (name, options) => {
      if (!analyticsEnabled()) return;
      const id = visitorId();
      if (!id) return;
      if (options?.oncePerSession && !firstInSession(name)) return;
      void send({ visitorId: id, name });
    },
    [send],
  );
}
