/** A full profile as the server sends it, for the screens that read it. */
export const PROFILE = {
  displayName: 'Дмитрий',
  memberSince: '2026-09-02',
  level: { level: 4, xpInLevel: 240, xpForNext: 400 },
  xpTotal: 1240,
  streak: { current: 3, best: 9 },
  puzzles: { rating: 1040, solved: 58 },
  games: { played: 12, wins: 7, draws: 1, losses: 4 },
  week: [
    { day: '2026-09-27', done: false, today: false },
    { day: '2026-09-28', done: true, today: false },
    { day: '2026-09-29', done: true, today: false },
    { day: '2026-09-30', done: true, today: false },
    { day: '2026-10-01', done: false, today: false },
    { day: '2026-10-02', done: true, today: false },
    { day: '2026-10-03', done: true, today: true },
  ],
  month: [
    { day: '2026-10-01', done: true, today: false },
    { day: '2026-10-02', done: true, today: false },
    { day: '2026-10-03', done: false, today: true },
  ],
  ratingHistory: [
    { day: '2026-09-26', rating: 800 },
    { day: '2026-10-03', rating: 1040 },
  ],
  achievements: [
    { key: 'first-lesson', current: 1, target: 1, unlocked: true },
    { key: 'first-mate', current: 1, target: 1, unlocked: true },
    { key: 'streak-7', current: 4, target: 7, unlocked: false },
    { key: 'review-5', current: 3, target: 5, unlocked: false },
    { key: 'beat-bear', current: 0, target: 1, unlocked: false },
  ],
  themes: [
    { key: 'pin', title: 'Связка', accuracy: 31, attempts: 8 },
    { key: 'mateIn1', title: 'Мат в 1 ход', accuracy: 82, attempts: 12 },
  ],
  cards: { due: 2, total: 3 },
  wardrobe: {
    selected: 'none',
    items: [
      { key: 'none', unlocked: true },
      { key: 'scarf', unlocked: true },
      { key: 'glasses', unlocked: false },
      { key: 'crown', unlocked: false },
      { key: 'hat', unlocked: false },
      { key: 'medal', unlocked: false },
    ],
  },
};
