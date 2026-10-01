import {
  ApiErrorSchema,
  AuthResponseSchema,
  CatalogResponseSchema,
  CompleteLessonResponseSchema,
  LessonDetailSchema,
  ProgressSummarySchema,
} from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { dayKeyOf, shiftDay } from '../progress/streak.js';
import type { RedisService } from '../redis/redis.service.js';
import { seedLessons } from '../seed/seed-lessons.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/lessons', import.meta.url));
const GOAL_SECONDS = 600;
// basics-board: text, text, find-squares, quiz, quiz
const BOARD_ALL_FIRST_TRY = [1, 1, 1, 1, 1];
const BOARD_ONE_RETRY = [1, 1, 2, 1, 1];

describe('lessons and progress', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let token: string;
  let userId: string;
  const today = () => dayKeyOf(new Date());

  beforeAll(async () => {
    ({ app, prisma, redis, mail } = await createTestApp());
    await prisma.lesson.deleteMany();
    await seedLessons(prisma, CONTENT_DIR);
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'cat@example.com', password: 'long-enough-password' },
    });
    const body = AuthResponseSchema.parse(res.json());
    token = body.accessToken;
    userId = body.user.id;
    // The verification email goes out after the answer, let it finish before the next test cleans up
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(0));
  });

  const get = (url: string, auth = true) =>
    app.inject({ method: 'GET', url, headers: auth ? { authorization: `Bearer ${token}` } : {} });

  const complete = (
    id: string,
    attempts: number[],
    over: { seconds?: number; localDate?: string } = {},
  ) =>
    app.inject({
      method: 'POST',
      url: `/lessons/${id}/complete`,
      headers: { authorization: `Bearer ${token}` },
      payload: { attempts, seconds: over.seconds ?? 120, localDate: over.localDate ?? today() },
    });

  const catalog = async () => CatalogResponseSchema.parse((await get('/lessons')).json()).lessons;

  describe('catalog', () => {
    it('needs a signed-in user', async () => {
      expect((await get('/lessons', false)).statusCode).toBe(401);
    });

    it('lists the chapters in order and opens only the first one', async () => {
      const lessons = await catalog();
      expect(lessons.map((l) => l.id)).toEqual([
        'basics-board',
        'basics-rook',
        'basics-knight',
        'basics-check',
      ]);
      expect(lessons.map((l) => l.status)).toEqual(['available', 'locked', 'locked', 'locked']);
      expect(lessons.every((l) => l.stars === 0)).toBe(true);
      expect(lessons[0]).toMatchObject({ order: 1, title: 'Доска и фигуры', track: 'basics' });
    });

    it('marks a premium chapter without revealing its steps', async () => {
      await prisma.lesson.create({
        data: {
          id: 'basics-secret',
          track: 'basics',
          order: 5,
          access: 'premium',
          title: 'Секретная глава',
          summary: 'Только для подписчиков',
          minutes: 5,
          steps: [],
          contentHash: 'x',
        },
      });
      const lessons = await catalog();
      expect(lessons.find((l) => l.id === 'basics-secret')?.status).toBe('premium');

      const res = await get('/lessons/basics-secret');
      expect(res.statusCode).toBe(403);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('lesson.premium');
      expect(res.body).not.toContain('steps');
      await prisma.lesson.delete({ where: { id: 'basics-secret' } });
    });
  });

  describe('lesson', () => {
    it('returns the steps of an open chapter', async () => {
      const res = await get('/lessons/basics-board');
      expect(res.statusCode).toBe(200);
      const lesson = LessonDetailSchema.parse(res.json());
      expect(lesson.steps).toHaveLength(5);
      expect(lesson.steps.map((s) => s.type)).toEqual([
        'text',
        'text',
        'find-squares',
        'quiz',
        'quiz',
      ]);
    });

    it('keeps a chapter closed until the previous one is finished', async () => {
      const res = await get('/lessons/basics-rook');
      expect(res.statusCode).toBe(403);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('lesson.locked');
    });

    it('says so when there is no such chapter', async () => {
      const res = await get('/lessons/no-such-lesson');
      expect(res.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('lesson.not_found');
    });
  });

  describe('finishing a lesson', () => {
    it('gives XP, three stars for a clean run and opens the next chapter', async () => {
      const res = await complete('basics-board', BOARD_ALL_FIRST_TRY);
      expect(res.statusCode).toBe(200);
      const result = CompleteLessonResponseSchema.parse(res.json());
      expect(result).toMatchObject({
        xp: 20,
        accuracy: 1,
        stars: 3,
        firstTime: true,
        nextLessonId: 'basics-rook',
      });
      expect(result.progress).toMatchObject({ xpTotal: 20, todaySeconds: 120 });

      const lessons = await catalog();
      expect(lessons.map((l) => l.status)).toEqual(['completed', 'available', 'locked', 'locked']);
      expect(lessons[0]?.stars).toBe(3);
    });

    it('works out accuracy from the tries, the client does not claim it', async () => {
      const result = CompleteLessonResponseSchema.parse(
        (await complete('basics-board', BOARD_ONE_RETRY)).json(),
      );
      // Three tasks, two solved at the first try
      expect(result.accuracy).toBeCloseTo(2 / 3);
      expect(result.stars).toBe(1);
    });

    it('gives less XP for a repeat and never lowers the best result', async () => {
      await complete('basics-board', BOARD_ALL_FIRST_TRY);
      const repeat = CompleteLessonResponseSchema.parse(
        (await complete('basics-board', BOARD_ONE_RETRY)).json(),
      );
      expect(repeat).toMatchObject({ xp: 5, firstTime: false });
      expect((await catalog())[0]?.stars).toBe(3);
    });

    it('counts a chapter the learner finished as done even for the next track member', async () => {
      await complete('basics-board', BOARD_ALL_FIRST_TRY);
      expect((await get('/lessons/basics-rook')).statusCode).toBe(200);
    });

    it('refuses a report that does not match the lesson', async () => {
      const res = await complete('basics-board', [1, 1]);
      expect(res.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(res.json()).code).toBe('lesson.invalid_report');
    });

    it('refuses a locked chapter', async () => {
      expect((await complete('basics-rook', [1, 1, 1, 1, 1])).statusCode).toBe(403);
    });

    it('does not trust an absurd amount of time', async () => {
      const result = CompleteLessonResponseSchema.parse(
        (await complete('basics-board', BOARD_ALL_FIRST_TRY, { seconds: 3600 })).json(),
      );
      // 5 minutes of lesson, at most 3 minutes per minute of lesson counted
      expect(result.progress.todaySeconds).toBe(900);
    });

    it('refuses a day far from the server day and accepts a neighbouring one', async () => {
      const far = await complete('basics-board', BOARD_ALL_FIRST_TRY, {
        localDate: shiftDay(today(), -5),
      });
      expect(far.statusCode).toBe(400);
      const near = await complete('basics-board', BOARD_ALL_FIRST_TRY, {
        localDate: shiftDay(today(), -1),
      });
      expect(near.statusCode).toBe(200);
    });

    it('rejects a malformed body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/lessons/basics-board/complete',
        headers: { authorization: `Bearer ${token}` },
        payload: { attempts: [0, 1, 1, 1, 1], seconds: 10, localDate: 'yesterday' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('daily goal and streak', () => {
    it('tells when the goal is reached and extends the streak once per day', async () => {
      const first = CompleteLessonResponseSchema.parse(
        (await complete('basics-board', BOARD_ALL_FIRST_TRY, { seconds: GOAL_SECONDS })).json(),
      );
      expect(first.goalReachedNow).toBe(true);
      expect(first.progress).toMatchObject({ streakDays: 1, goalSeconds: GOAL_SECONDS });

      const second = CompleteLessonResponseSchema.parse(
        (await complete('basics-rook', [1, 1, 1, 1, 1], { seconds: 120 })).json(),
      );
      expect(second.goalReachedNow).toBe(false);
      expect(second.progress.streakDays).toBe(1);
    });

    it('does not reach the goal with a short lesson', async () => {
      const result = CompleteLessonResponseSchema.parse(
        (await complete('basics-board', BOARD_ALL_FIRST_TRY, { seconds: 60 })).json(),
      );
      expect(result.goalReachedNow).toBe(false);
      expect(result.progress.streakDays).toBe(0);
    });

    it('counts earlier days in the summary and keeps the streak until the day is over', async () => {
      const day = (offset: number) => new Date(`${shiftDay(today(), offset)}T00:00:00Z`);
      await prisma.dailyActivity.createMany({
        data: [
          { userId, day: day(-1), seconds: GOAL_SECONDS, xp: 20 },
          { userId, day: day(-2), seconds: GOAL_SECONDS, xp: 20 },
          { userId, day: day(-4), seconds: GOAL_SECONDS, xp: 20 },
        ],
      });
      const res = await get(`/progress/summary?localDate=${today()}`);
      expect(res.statusCode).toBe(200);
      expect(ProgressSummarySchema.parse(res.json())).toEqual({
        streakDays: 2,
        todaySeconds: 0,
        goalSeconds: GOAL_SECONDS,
        xpTotal: 60,
      });
    });

    it('follows the goal the learner picked', async () => {
      await prisma.user.update({ where: { id: userId }, data: { dailyGoalMinutes: 5 } });
      const result = CompleteLessonResponseSchema.parse(
        (await complete('basics-board', BOARD_ALL_FIRST_TRY, { seconds: 300 })).json(),
      );
      expect(result.goalReachedNow).toBe(true);
      expect(result.progress.goalSeconds).toBe(300);
    });

    it('needs a signed-in user', async () => {
      expect((await get('/progress/summary', false)).statusCode).toBe(401);
    });
  });
});
