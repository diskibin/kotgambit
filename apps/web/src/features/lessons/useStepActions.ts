import { useAppDispatch } from '../../app/hooks';

/** The moves of the lesson session that every step can make. */
export function useStepActions() {
  const dispatch = useAppDispatch();
  return {
    check: (correct: boolean) => dispatch({ type: 'step/checked', correct }),
    retry: () => dispatch({ type: 'step/retried' }),
    hint: () => dispatch({ type: 'hint/requested' }),
    advance: () => dispatch({ type: 'step/advanced', now: Date.now() }),
  };
}
