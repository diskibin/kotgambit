import { useEffect } from 'react';
import { useAppSelector } from '../../app/hooks';

/** Puts the chosen theme on <html>, where tokens.css picks it up. "System" leaves the choice to the media query. */
export function ThemeSync() {
  const preference = useAppSelector((state) => state.theme.preference);
  const reduceMotion = useAppSelector((state) => state.ui.reduceMotion);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') delete root.dataset['theme'];
    else root.dataset['theme'] = preference;
  }, [preference]);

  // The choice "reduce motion" of the settings, on top of what the system asks for (styles/index.css)
  useEffect(() => {
    const root = document.documentElement;
    if (reduceMotion) root.dataset['reduceMotion'] = 'true';
    else delete root.dataset['reduceMotion'];
  }, [reduceMotion]);

  return null;
}
