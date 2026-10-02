export type ThemeGroup = 'mate' | 'tactics' | 'endgame';

export const THEME_GROUPS: readonly ThemeGroup[] = ['mate', 'tactics', 'endgame'];

/**
 * The tab of the catalog a Lichess theme belongs to: every mate on its own, the endgames on theirs,
 * and everything else (forks, pins, the phases of the game) is tactics.
 */
export function themeGroup(key: string): ThemeGroup {
  if (/mate/i.test(key)) return 'mate';
  if (/endgame/i.test(key)) return 'endgame';
  return 'tactics';
}
