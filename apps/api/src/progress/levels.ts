export interface Level {
  level: number;
  /** XP earned inside the current level. */
  xpInLevel: number;
  /** XP the current level asks for, so that `xpInLevel / xpForNext` is the bar. */
  xpForNext: number;
}

// Level n asks for 100 * n XP, so the first levels come quickly and later ones take weeks of play:
// level 4 is 240 of 400 after 300 + 240 XP, the numbers of the design (web/screens/profile.md)
const XP_PER_LEVEL_STEP = 100;

/** The level that a total of XP reaches. */
export function levelOf(totalXp: number): Level {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (remaining >= level * XP_PER_LEVEL_STEP) {
    remaining -= level * XP_PER_LEVEL_STEP;
    level += 1;
  }
  return { level, xpInLevel: remaining, xpForNext: level * XP_PER_LEVEL_STEP };
}
