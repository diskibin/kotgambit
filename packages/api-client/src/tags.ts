export const TAG_TYPES = ['Me', 'Lessons', 'Progress', 'Puzzles'] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const REDUCER_PATH = 'api';
