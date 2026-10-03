import { useEffect } from 'react';
import { useUpdateSettingsMutation } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { clearPending, loadPending } from './onboardingAnswers';

/** Hands the goal chosen before signing up to the new account, once, and forgets it. */
export function ApplyOnboarding() {
  const signedIn = useAppSelector((state) => state.auth.status === 'authenticated');
  const [updateSettings] = useUpdateSettingsMutation();

  useEffect(() => {
    if (!signedIn) return;
    const pending = loadPending();
    if (!pending) return;
    // Forgotten at once: a second tab must not send it again while the first request is on its way
    clearPending();
    void updateSettings({ dailyGoalMinutes: pending.goal });
  }, [signedIn, updateSettings]);

  return null;
}
