import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { createTestApp } from '../../test/create-app.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { seedLessons } from './seed-lessons.js';

const TEMPLATE = join(
  fileURLToPath(new URL('../../../../content/lessons', import.meta.url)),
  'endgame',
  '05-extra-material.yaml',
);

describe('seeding lessons into the database', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let root: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'kotgambit-seed-'));
    await prisma.lesson.deleteMany();
  });
  afterEach(async () => {
    rmSync(root, { recursive: true, force: true });
    await prisma.lesson.deleteMany();
  });

  /** Chapters of one track made from a real one, so that the numbers are the only thing that differs. */
  function write(chapters: Record<string, number>) {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(join(root, 'mates'), { recursive: true });
    const template = parse(readFileSync(TEMPLATE, 'utf8')) as Record<string, unknown>;
    for (const [id, order] of Object.entries(chapters)) {
      writeFileSync(
        join(root, 'mates', `${id}.yaml`),
        stringify({ ...template, id, track: 'mates', order }),
      );
    }
  }
  const orders = async () =>
    Object.fromEntries((await prisma.lesson.findMany()).map((row) => [row.id, row.order]));
  const seed = () => seedLessons(prisma as unknown as PrismaClient, root);

  it('loads the chapters and does it again without trouble', async () => {
    write({ 'mates-a': 1, 'mates-b': 2 });
    await seed();
    await seed();
    expect(await orders()).toEqual({ 'mates-a': 1, 'mates-b': 2 });
  });

  it('lets two chapters trade their numbers', async () => {
    write({ 'mates-a': 1, 'mates-b': 2 });
    await seed();
    write({ 'mates-a': 2, 'mates-b': 1 });
    await seed();
    expect(await orders()).toEqual({ 'mates-a': 2, 'mates-b': 1 });
  });

  it('lets a new chapter take the number of one that moves further down', async () => {
    write({ 'mates-a': 1, 'mates-b': 2 });
    await seed();
    write({ 'mates-new': 1, 'mates-a': 2, 'mates-b': 3 });
    await seed();
    expect(await orders()).toEqual({ 'mates-new': 1, 'mates-a': 2, 'mates-b': 3 });
  });

  it('changes nothing when the content has a problem', async () => {
    write({ 'mates-a': 1, 'mates-b': 2 });
    await seed();
    write({ 'mates-a': 2, 'mates-b': 5 });
    await expect(seed()).rejects.toThrow(/chapter numbers must go/);
    expect(await orders()).toEqual({ 'mates-a': 1, 'mates-b': 2 });
  });
});
