import { useEffect } from 'react';
import { useUpdateSettingsMutation } from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { goalApplied } from './onboarding.slice';

/** Hands the goal chosen before signing up to the new account, once. */
export function ApplyOnboarding() {
  const dispatch = useAppDispatch();
  const goal = useAppSelector((state) => state.onboarding.pendingGoal);
  const signedIn = useAppSelector((state) => state.auth.status === 'authenticated');
  const [updateSettings] = useUpdateSettingsMutation();

  useEffect(() => {
    if (!signedIn || goal === null) return;
    // Forgotten at once, so that a second render does not send it again while the request is on its way
    dispatch(goalApplied());
    void updateSettings({ dailyGoalMinutes: goal });
  }, [signedIn, goal, dispatch, updateSettings]);

  return null;
}
