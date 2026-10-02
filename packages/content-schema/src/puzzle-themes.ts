import { z } from 'zod';

// The cat never says an answer is wrong in those words, see PLAN.md 6.5 and 14.2
const FORBIDDEN_WORDS = ['неверно', 'неправильно'];

/** The theme keys found in the Lichess puzzle database in October 2026. */
export const LICHESS_PUZZLE_THEMES = [
  'advancedPawn',
  'advantage',
  'anastasiaMate',
  'arabianMate',
  'attackingF2F7',
  'attraction',
  'backRankMate',
  'balestraMate',
  'blindSwineMate',
  'bishopEndgame',
  'bodenMate',
  'capturingDefender',
  'castling',
  'clearance',
  'collinearMove',
  'cornerMate',
  'crushing',
  'defensiveMove',
  'deflection',
  'discoveredAttack',
  'discoveredCheck',
  'doubleBishopMate',
  'doubleCheck',
  'dovetailMate',
  'endgame',
  'enPassant',
  'epauletteMate',
  'equality',
  'exposedKing',
  'fork',
  'hangingPiece',
  'hookMate',
  'interference',
  'intermezzo',
  'killBoxMate',
  'kingsideAttack',
  'knightEndgame',
  'long',
  'master',
  'masterVsMaster',
  'mate',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'mateIn4',
  'mateIn5',
  'middlegame',
  'morphysMate',
  'oneMove',
  'opening',
  'operaMate',
  'pawnEndgame',
  'pillsburysMate',
  'pin',
  'promotion',
  'queenEndgame',
  'queenRookEndgame',
  'queensideAttack',
  'quietMove',
  'rookEndgame',
  'sacrifice',
  'short',
  'skewer',
  'smotheredMate',
  'superGM',
  'swallowstailMate',
  'trappedPiece',
  'triangleMate',
  'underPromotion',
  'veryLong',
  'vukovicMate',
  'xRayAttack',
  'zugzwang',
] as const;

export const PuzzleThemeSchema = z.object({
  title: z.string().min(1),
  /** Meta labels such as "short" or "master games" are not something a learner picks to practise. */
  hidden: z.boolean().default(false),
});

/** `content/puzzle-themes.ru.yaml`: the Lichess theme keys with their Russian names. */
export const PuzzleThemesSchema = z.object({
  themes: z.record(z.string().regex(/^[a-zA-Z0-9]+$/), PuzzleThemeSchema),
});
export type PuzzleThemes = z.infer<typeof PuzzleThemesSchema>;

export function validatePuzzleThemes(file: PuzzleThemes): string[] {
  const problems: string[] = [];
  for (const key of LICHESS_PUZZLE_THEMES) {
    if (!(key in file.themes)) problems.push(`${key}: no Russian name`);
  }
  for (const [key, { title }] of Object.entries(file.themes)) {
    const found = FORBIDDEN_WORDS.find((word) => title.toLowerCase().includes(word));
    if (found) problems.push(`${key}: the word "${found}" does not fit the cat's voice`);
  }
  return problems;
}
