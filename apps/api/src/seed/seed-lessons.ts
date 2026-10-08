import {
  LessonSchema,
  validateCatalog,
  validateLesson,
  type Lesson,
} from '@kotgambit/content-schema';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { PrismaClient } from '../generated/prisma/client.js';

// More than a hundred chapters are written in one go, the default five seconds of a transaction are too tight
const SEED_TIMEOUT_MS = 120_000;

function lessonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return lessonFiles(path);
    return /\.ya?ml$/.test(name) ? [path] : [];
  });
}

/**
 * Reads and fully validates the lesson files of all the directories, so that nothing broken ever reaches
 * the database. The catalog is checked over the union: the premium chapters of a track continue the
 * numbering of the free ones, so neither directory is valid on its own.
 */
export function loadLessons(dirs: string | readonly string[]): Lesson[] {
  const lessons: Lesson[] = [];
  const problems: string[] = [];

  for (const dir of typeof dirs === 'string' ? [dirs] : dirs) {
    for (const file of lessonFiles(dir)) {
      const parsed = LessonSchema.safeParse(parse(readFileSync(file, 'utf8')));
      if (!parsed.success) {
        for (const issue of parsed.error.issues)
          problems.push(`${file}: ${issue.path.join('.')}: ${issue.message}`);
        continue;
      }
      lessons.push(parsed.data);
      for (const issue of validateLesson(parsed.data))
        problems.push(`${file}: ${issue.path}: ${issue.message}`);
    }
  }
  for (const issue of validateCatalog(lessons))
    problems.push(`catalog: ${issue.path}: ${issue.message}`);

  if (problems.length > 0) throw new Error(`The content has problems:\n${problems.join('\n')}`);
  return lessons;
}

/**
 * Adds or updates lessons by id. Lessons that disappeared from the files stay: nothing is deleted without a say-so.
 * A track and an order go together only once, and new chapters may take the numbers of chapters that move
 * further down the track. So the chapters that move first step aside to numbers nobody uses, and everything
 * happens in one transaction: a seed that fails half way changes nothing.
 */
export async function seedLessons(
  prisma: PrismaClient,
  dirs: string | readonly string[],
): Promise<number> {
  const lessons = loadLessons(dirs);
  await prisma.$transaction(
    async (tx) => {
      const existing = new Map(
        (await tx.lesson.findMany({ select: { id: true, track: true, order: true } })).map(
          (row) => [row.id, row],
        ),
      );
      const moving = lessons.filter((lesson) => {
        const row = existing.get(lesson.id);
        return row !== undefined && (row.track !== lesson.track || row.order !== lesson.order);
      });
      for (const [index, lesson] of moving.entries()) {
        await tx.lesson.update({ where: { id: lesson.id }, data: { order: -(index + 1) } });
      }
      for (const lesson of lessons) {
        const { steps, ...fields } = lesson;
        const contentHash = createHash('sha256').update(JSON.stringify(lesson)).digest('hex');
        const data = { ...fields, steps, contentHash };
        await tx.lesson.upsert({ where: { id: lesson.id }, create: data, update: data });
      }
    },
    { timeout: SEED_TIMEOUT_MS },
  );
  return lessons.length;
}
