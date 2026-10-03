import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useUiPreferences } from '../features/settings/useUiPreferences';

/** The system setting or the learner's own choice in the settings: either of them is enough. */
export function useReducedMotion(): boolean {
  const [system, setSystem] = useState(false);
  const { reduceMotion } = useUiPreferences();

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setSystem(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return system || reduceMotion;
}
