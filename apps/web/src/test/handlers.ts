import { http, HttpResponse } from 'msw';
import { API_URL } from './renderApp';

export const PROGRESS = { streakDays: 0, todaySeconds: 0, goalSeconds: 600, xpTotal: 0 };

export const LESSONS = [
  {
    id: 'basics-board',
    track: 'basics',
    order: 1,
    piece: 'k',
    title: 'Доска и фигуры',
    summary: 'Знакомимся с доской.',
    minutes: 5,
    stepCount: 5,
    status: 'available',
    stars: 0,
  },
  {
    id: 'basics-rook',
    track: 'basics',
    order: 2,
    piece: 'r',
    title: 'Как ходит ладья',
    summary: 'Ладья ездит по прямой.',
    minutes: 5,
    stepCount: 5,
    status: 'locked',
    stars: 0,
  },
];

/** The home screen asks for the catalog and the day bar as soon as someone is signed in. */
export function homeHandlers(lessons: unknown[] = LESSONS) {
  return [
    http.get(`${API_URL}/lessons`, () => HttpResponse.json({ lessons })),
    http.get(`${API_URL}/progress/summary`, () => HttpResponse.json(PROGRESS)),
  ];
}
