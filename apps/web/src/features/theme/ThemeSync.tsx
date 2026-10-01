import { useEffect } from 'react';
import { useAppSelector } from '../../app/hooks';

/** Puts the chosen theme on <html>, where tokens.css picks it up. "System" leaves the choice to the media query. */
export function ThemeSync() {
  const preference = useAppSelector((state) => state.theme.preference);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') delete root.dataset['theme'];
    else root.dataset['theme'] = preference;
  }, [preference]);

  return null;
}
