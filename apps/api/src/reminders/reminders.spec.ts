import { AuthResponseSchema } from '@kotgambit/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/create-app.js';
import type { MemoryMailTransport } from '../../test/memory-mail.transport.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import { RemindersService } from './reminders.service.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
// The hour of the day when reminders go out, 15:00 UTC by default
const SEND_TIME = new Date('2026-10-06T15:10:00.000Z');
const day = (offset: number) =>
  new Date(
    `${new Date(SEND_TIME.getTime() - offset * MS_IN_DAY).toISOString().slice(0, 10)}T00:00:00.000Z`,
  );

describe('reminders', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let mail: MemoryMailTransport;
  let reminders: RemindersService;

  beforeAll(async () => {
    ({ app, prisma, redis, mail } = await createTestApp());
    reminders = app.get(RemindersService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await redis.client.flushdb();
    await prisma.user.deleteMany();
    mail.clear();
  });

  /** A learner who agreed, confirmed the email and has been away for a while. */
  async function learner(email: string, over: Record<string, unknown> = {}) {
    // Read before the request: the mail can be sent before the answer is back in the test
    const sent = mail.outbox.length;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'long-enough-password', displayName: 'Маша' },
    });
    await vi.waitFor(() => expect(mail.outbox.length).toBeGreaterThan(sent));
    const { user } = AuthResponseSchema.parse(res.json());
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        remindersEnabled: true,
        createdAt: new Date(SEND_TIME.getTime() - 10 * MS_IN_DAY),
        ...over,
      },
    });
    return user.id;
  }

  const letters = () => mail.outbox.filter((message) => message.subject === 'Гамбит ждёт тебя');

  it('writes to a learner who agreed and has been away for two days', async () => {
    const id = await learner('away@example.com');
    await prisma.dailyActivity.create({ data: { userId: id, day: day(2) } });
    mail.clear();

    expect(await reminders.runScheduled(SEND_TIME)).toBe(1);
    expect(letters()).toHaveLength(1);
    const letter = letters()[0];
    expect(letter?.to).toBe('away@example.com');
    expect(letter?.text).toContain('Маша');
    expect(letter?.text).toContain('10 минут');
    expect(letter?.text).toContain('/learn');
    expect(letter?.text).toContain('/unsubscribe?token=');
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).lastReminderAt).toEqual(
      SEND_TIME,
    );
  });

  it('writes to a learner who never came back after signing up', async () => {
    await learner('never@example.com');
    mail.clear();
    expect(await reminders.runScheduled(SEND_TIME)).toBe(1);
  });

  it('leaves alone whoever did not agree, did not confirm the email, or is new', async () => {
    await learner('no-consent@example.com', { remindersEnabled: false });
    await learner('unconfirmed@example.com', { emailVerifiedAt: null });
    await learner('new@example.com', { createdAt: new Date(SEND_TIME.getTime() - MS_IN_DAY) });
    mail.clear();
    expect(await reminders.runScheduled(SEND_TIME)).toBe(0);
    expect(letters()).toHaveLength(0);
  });

  it('leaves alone whoever studied yesterday or today', async () => {
    const yesterday = await learner('yesterday@example.com');
    const today = await learner('today@example.com');
    await prisma.dailyActivity.create({ data: { userId: yesterday, day: day(1) } });
    await prisma.dailyActivity.create({ data: { userId: today, day: day(0) } });
    mail.clear();
    expect(await reminders.runScheduled(SEND_TIME)).toBe(0);
  });

  it('does not write again within a week, and writes again after it', async () => {
    const id = await learner('away@example.com');
    mail.clear();
    expect(await reminders.runScheduled(SEND_TIME)).toBe(1);
    expect(await reminders.runScheduled(new Date(SEND_TIME.getTime() + 60 * 60 * 1000))).toBe(0);
    await prisma.user.update({
      where: { id },
      data: { lastReminderAt: new Date(SEND_TIME.getTime() - 8 * MS_IN_DAY) },
    });
    expect(await reminders.runScheduled(SEND_TIME)).toBe(1);
  });

  it('goes out only in the hour that is set', async () => {
    await learner('away@example.com');
    mail.clear();
    expect(await reminders.runScheduled(new Date('2026-10-06T14:59:00.000Z'))).toBe(0);
    expect(await reminders.runScheduled(new Date('2026-10-06T16:00:00.000Z'))).toBe(0);
    expect(letters()).toHaveLength(0);
  });

  it('tries again at the next check when a letter could not be sent', async () => {
    const id = await learner('away@example.com');
    mail.clear();
    const send = vi.spyOn(mail, 'send').mockRejectedValueOnce(new Error('smtp down'));
    expect(await reminders.runScheduled(SEND_TIME)).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).lastReminderAt).toBeNull();
    send.mockRestore();
    expect(await reminders.runScheduled(SEND_TIME)).toBe(1);
  });

  describe('the way out', () => {
    it('switches the reminders off from the link of a letter, without signing in', async () => {
      const id = await learner('away@example.com');
      const token = new URL(reminders.unsubscribeUrl(id)).searchParams.get('token') as string;
      const res = await app.inject({
        method: 'POST',
        url: '/reminders/unsubscribe',
        payload: { token },
      });
      expect(res.statusCode).toBe(204);
      expect((await prisma.user.findUniqueOrThrow({ where: { id } })).remindersEnabled).toBe(false);
      mail.clear();
      expect(await reminders.runScheduled(SEND_TIME)).toBe(0);
    });

    it('works again on the same link, and for an account that has gone', async () => {
      const id = await learner('away@example.com');
      const token = new URL(reminders.unsubscribeUrl(id)).searchParams.get('token') as string;
      const unsubscribe = () =>
        app.inject({ method: 'POST', url: '/reminders/unsubscribe', payload: { token } });
      expect((await unsubscribe()).statusCode).toBe(204);
      expect((await unsubscribe()).statusCode).toBe(204);
      await prisma.user.delete({ where: { id } });
      expect((await unsubscribe()).statusCode).toBe(204);
    });

    it('refuses a token that is not ours', async () => {
      const id = await learner('away@example.com');
      const res = await app.inject({
        method: 'POST',
        url: '/reminders/unsubscribe',
        payload: { token: `${id}.forged` },
      });
      expect(res.statusCode).toBe(400);
      expect((await prisma.user.findUniqueOrThrow({ where: { id } })).remindersEnabled).toBe(true);
    });
  });
});
