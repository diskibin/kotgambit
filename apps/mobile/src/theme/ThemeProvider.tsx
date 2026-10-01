import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type ThemeColors } from './theme';

/** The light theme is typed with literals, the dark one has to fit the same shape with other values. */
export type Colors = { [K in keyof ThemeColors]: string };

export type ThemePreference = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

interface ThemeValue {
  scheme: Scheme;
  colors: Colors;
}

const ThemeContext = createContext<ThemeValue>({ scheme: 'light', colors: themes.light });

interface ThemeProviderProps {
  preference?: ThemePreference;
  children: ReactNode;
}

export function ThemeProvider({ preference = 'system', children }: ThemeProviderProps) {
  const system = useColorScheme();
  const scheme: Scheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(() => ({ scheme, colors: themes[scheme] }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
