import { TRACKS } from '@kotgambit/content-schema';

type Track = (typeof TRACKS)[number];

const OTHER_SECTIONS_SHOWN = 3;

/**
 * The three cards under the ribbon: one section behind the current one and two ahead of it. Where there
 * is no section behind, three go ahead; where one is ahead only, two go behind. The sections that are only
 * announced come last, to fill the row.
 */
export function otherSections(present: readonly Track[], current: Track | undefined): Track[] {
  const rest = present.filter((item) => item !== current);
  const here = current ? present.indexOf(current) : present.length;
  const behind = rest.filter((item) => present.indexOf(item) < here);
  const ahead = rest.filter((item) => present.indexOf(item) > here);
  let behindCount = Math.min(behind.length, 1);
  const aheadCount = Math.min(ahead.length, OTHER_SECTIONS_SHOWN - behindCount);
  behindCount = Math.min(behind.length, OTHER_SECTIONS_SHOWN - aheadCount);
  const shown = [...behind.slice(behind.length - behindCount), ...ahead.slice(0, aheadCount)];
  const announced = TRACKS.filter((item) => !present.includes(item));
  return [...shown, ...announced].slice(0, OTHER_SECTIONS_SHOWN);
}
