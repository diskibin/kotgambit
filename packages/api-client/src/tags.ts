export const TAG_TYPES = [
  'Me',
  'Lessons',
  'Progress',
  'Puzzles',
  'Games',
  'Reviews',
  'Cards',
  'Billing',
] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const REDUCER_PATH = 'api';
