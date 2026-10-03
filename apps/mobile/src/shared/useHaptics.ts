import { Vibration } from 'react-native';
import { useUiPreferences } from '../features/settings/useUiPreferences';

// Short on success, two taps on a miss: the phone says the same as the card, without sound
const PATTERNS = { success: 12, error: [0, 20, 60, 20] } as const;

export type Haptic = keyof typeof PATTERNS;

/** Vibrates for an answer, unless the learner switched the vibration off in the settings. */
export function useHaptics(): (kind: Haptic) => void {
  const { vibration } = useUiPreferences();
  return (kind) => {
    if (!vibration) return;
    const pattern = PATTERNS[kind];
    Vibration.vibrate(typeof pattern === 'number' ? pattern : [...pattern]);
  };
}
