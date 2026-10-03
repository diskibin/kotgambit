export const TAG_TYPES = ['Me', 'Lessons', 'Progress', 'Puzzles', 'Games'] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const REDUCER_PATH = 'api';
