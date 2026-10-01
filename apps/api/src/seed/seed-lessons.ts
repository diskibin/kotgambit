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

function lessonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return lessonFiles(path);
    return /\.ya?ml$/.test(name) ? [path] : [];
  });
}

/** Reads and fully validates the lesson files, so that nothing broken ever reaches the database. */
export function loadLessons(dir: string): Lesson[] {
  const lessons: Lesson[] = [];
  const problems: string[] = [];

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
  for (const issue of validateCatalog(lessons))
    problems.push(`catalog: ${issue.path}: ${issue.message}`);

  if (problems.length > 0) throw new Error(`The content has problems:\n${problems.join('\n')}`);
  return lessons;
}

/** Adds or updates lessons by id. Lessons that disappeared from the files stay: nothing is deleted without a say-so. */
export async function seedLessons(prisma: PrismaClient, dir: string): Promise<number> {
  const lessons = loadLessons(dir);
  for (const lesson of lessons) {
    const { steps, ...fields } = lesson;
    const contentHash = createHash('sha256').update(JSON.stringify(lesson)).digest('hex');
    const data = { ...fields, steps, contentHash };
    await prisma.lesson.upsert({ where: { id: lesson.id }, create: data, update: data });
  }
  return lessons.length;
}
