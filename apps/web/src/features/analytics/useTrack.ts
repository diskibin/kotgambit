import type { AnalyticsEventName, NudgeKind } from '@kotgambit/contracts';
import { useCallback } from 'react';
import { useTrackEventMutation } from '../../app/api';
import { analyticsEnabled, firstInSession, visitorId } from './tracker';

interface TrackOptions {
  /** Count it once in a browser session, however many times it happens. */
  oncePerSession?: boolean;
  /** Which hint about Premium, for the two events about hints. */
  detail?: NudgeKind;
}

/** Reports a step of the visitor. Never waits, never fails loudly: counting must not get in the way. */
export function useTrack(): (name: AnalyticsEventName, options?: TrackOptions) => void {
  const [send] = useTrackEventMutation();
  return useCallback(
    (name, options) => {
      if (!analyticsEnabled()) return;
      const id = visitorId();
      if (!id) return;
      // A step with a detail is counted once for each detail: seeing two hints is two steps
      const key = options?.detail ? `${name}.${options.detail}` : name;
      if (options?.oncePerSession && !firstInSession(key)) return;
      void send({ visitorId: id, name, ...(options?.detail ? { detail: options.detail } : {}) });
    },
    [send],
  );
}
