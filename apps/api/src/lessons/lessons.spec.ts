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
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { dayKeyOf, shiftDay } from '../progress/streak.js';
import type { RedisService } from '../redis/redis.service.js';
import { seedLessons } from '../seed/seed-lessons.js';

const CONTENT_DIR = fileURLToPath(new URL('../../../../content/lessons', import.meta.url));
const GOAL_SECONDS = 600;
// basics-board has 12 steps, four of them are tasks: the steps 3 and 4, 11 and 12
const BOARD_STEPS = 12;
const BOARD_ALL_FIRST_TRY = Array.from({ length: BOARD_STEPS }, () => 1);
// Two of the four tasks took a second try
const BOARD_TWO_RETRIES = BOARD_ALL_FIRST_TRY.map((tries, index) =>
  index === 2 || index === 3 ? 2 : tries,
);
// These tests are written for the first four chapters. The real content keeps growing, and a new
// chapter must not change what they count or take the order numbers they use.
const TESTED_LESSONS = ['basics-board', 'basics-rook', 'basics-knight', 'basics-check'];

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
    await prisma.lesson.deleteMany({ where: { id: { notIn: TESTED_LESSONS } } });
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

    describe('the sections one after another', () => {
      const openings = (id: string, order: number, access: 'free' | 'premium' = 'free') =>
        prisma.lesson.create({
          data: {
            id,
            track: 'openings',
            order,
            access,
            piece: 'n',
            title: `Дебют ${order}`,
            summary: 's',
            minutes: 5,
            steps: [{}, {}],
            contentHash: 'x',
          },
        });
      const finish = async (ids: string[]) => {
        const user = await prisma.user.findFirstOrThrow();
        await prisma.lessonProgress.createMany({
          data: ids.map((lessonId) => ({
            userId: user.id,
            lessonId,
            bestAccuracy: 1,
            stars: 3,
            completedAt: new Date(),
          })),
        });
      };
      // The chapters of these tests are not part of the lessons that the others expect to find
      afterEach(async () => {
        await prisma.lesson.deleteMany({
          where: { id: { in: ['openings-1', 'openings-2', 'basics-bonus', 'endgame-1'] } },
        });
      });
      const statuses = async () =>
        Object.fromEntries((await catalog()).map((lesson) => [lesson.id, lesson.status]));

      it('keeps the next section closed until the Basics are done', async () => {
        await openings('openings-1', 1);
        await openings('openings-2', 2);
        expect(await statuses()).toMatchObject({
          'basics-board': 'available',
          'openings-1': 'locked',
          'openings-2': 'locked',
        });
        // Not even by its address
        expect((await get('/lessons/openings-1')).statusCode).toBe(403);
        await finish(['basics-board', 'basics-rook', 'basics-knight']);
        expect((await statuses())['openings-1']).toBe('locked');
      });

      it('opens the first chapter of the next section when the last of the Basics is done', async () => {
        await openings('openings-1', 1);
        await openings('openings-2', 2);
        await finish(['basics-board', 'basics-rook', 'basics-knight', 'basics-check']);
        expect(await statuses()).toMatchObject({
          'openings-1': 'available',
          'openings-2': 'locked',
        });
        // Open: the steps of this invented chapter are not real, so only that it is not refused is checked
        expect((await get('/lessons/openings-1')).statusCode).not.toBe(403);
      });

      it('opens every section once the Basics are done, they do not wait for each other', async () => {
        await openings('openings-1', 1);
        await prisma.lesson.create({
          data: {
            id: 'endgame-1',
            track: 'endgame',
            order: 1,
            access: 'free',
            piece: 'r',
            title: 'Эндшпиль 1',
            summary: 's',
            minutes: 5,
            steps: [{}, {}],
            contentHash: 'x',
          },
        });
        expect(await statuses()).toMatchObject({ 'openings-1': 'locked', 'endgame-1': 'locked' });
        await finish(['basics-board', 'basics-rook', 'basics-knight', 'basics-check']);
        expect(await statuses()).toMatchObject({
          'openings-1': 'available',
          'endgame-1': 'available',
        });
      });

      it('does not hold a free learner back for chapters that are only for Premium', async () => {
        await openings('openings-1', 1);
        await prisma.lesson.create({
          data: {
            id: 'basics-bonus',
            track: 'basics',
            order: 9,
            access: 'premium',
            piece: 'k',
            title: 'Бонус',
            summary: 's',
            minutes: 5,
            steps: [{}],
            contentHash: 'x',
          },
        });
        await finish(['basics-board', 'basics-rook', 'basics-knight', 'basics-check']);
        expect((await statuses())['openings-1']).toBe('available');
      });
    });

    it('marks a premium chapter without revealing its steps', async () => {
      await prisma.lesson.create({
        data: {
          id: 'basics-secret',
          track: 'basics',
          order: 5,
          access: 'premium',
          piece: 'k',
          title: 'Секретная глава',
          summary: 'Только для подписчиков',
          minutes: 5,
          // The catalog only counts the steps of a premium lesson, it never reads them
          steps: [{}, {}, {}],
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
      expect(lesson.steps).toHaveLength(BOARD_STEPS);
      expect(lesson.steps.map((s) => s.type)).toEqual([
        'text',
        'text',
        'find-squares',
        'quiz',
        ...Array.from({ length: 6 }, () => 'text'),
        'find-squares',
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
        (await complete('basics-board', BOARD_TWO_RETRIES)).json(),
      );
      // Four tasks, two solved at the first try
      expect(result.accuracy).toBeCloseTo(2 / 4);
      expect(result.stars).toBe(1);
    });

    it('gives less XP for a repeat and never lowers the best result', async () => {
      await complete('basics-board', BOARD_ALL_FIRST_TRY);
      const repeat = CompleteLessonResponseSchema.parse(
        (await complete('basics-board', BOARD_TWO_RETRIES)).json(),
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
      // 8 minutes of lesson, at most 3 minutes per minute of lesson counted
      expect(result.progress.todaySeconds).toBe(1440);
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
