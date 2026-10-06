import type { LearningStats } from '@kotgambit/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { dayKey, percent, periodStart, weekStart } from './stats.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const COHORT_WEEKS = 8;
const DAYS_IN_WEEK = 7;
// A theme with fewer tries says nothing about how hard it is
const MIN_THEME_ATTEMPTS = 5;
const WORST_THEMES = 15;
const PERCENT = 100;
const TENTH = 10;

interface CohortRow {
  week: string;
  size: number;
  d1: number;
  d7: number;
  d30: number;
}

interface LessonRow {
  id: string;
  title: string;
  track: string;
  completed: number;
  accuracy: number;
  attempts: number;
}

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(days: number, now: Date = new Date()): Promise<LearningStats> {
    const since = periodStart(now, days);
    const [funnel, cohorts, lessons, themes] = await Promise.all([
      this.funnel(since),
      this.cohorts(now),
      this.lessons(),
      this.themes(since),
    ]);
    return { days, funnel, cohorts, lessons, themes };
  }

  private async funnel(since: Date): Promise<LearningStats['funnel']> {
    const [row] = await this.prisma.$queryRaw<LearningStats['funnel'][]>`
      SELECT count(*)::int AS registered,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM lesson_progress l WHERE l.user_id = u.id))::int AS lesson,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM daily_activity a
          WHERE a.user_id = u.id AND a.day > u.created_at::date))::int AS returned,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM puzzle_attempts p
          WHERE p.user_id = u.id AND p.status = 'solved'))::int AS "solvedPuzzle",
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM games g WHERE g.user_id = u.id))::int AS "playedGame"
      FROM users u WHERE u.created_at >= ${since}`;
    return row ?? { registered: 0, lesson: 0, returned: 0, solvedPuzzle: 0, playedGame: 0 };
  }

  /** Per week of sign-ups: how many were active exactly 1, 7 and 30 days after the day they came. */
  private async cohorts(now: Date): Promise<LearningStats['cohorts']> {
    const first = new Date(
      weekStart(now).getTime() - (COHORT_WEEKS - 1) * DAYS_IN_WEEK * MS_IN_DAY,
    );
    const rows = await this.prisma.$queryRaw<CohortRow[]>`
      SELECT to_char(date_trunc('week', u.created_at), 'YYYY-MM-DD') AS week,
        count(*)::int AS size,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM daily_activity a
          WHERE a.user_id = u.id AND a.day = u.created_at::date + 1))::int AS d1,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM daily_activity a
          WHERE a.user_id = u.id AND a.day = u.created_at::date + 7))::int AS d7,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM daily_activity a
          WHERE a.user_id = u.id AND a.day = u.created_at::date + 30))::int AS d30
      FROM users u WHERE u.created_at >= ${first} GROUP BY 1`;

    const today = new Date(`${dayKey(now)}T00:00:00.000Z`).getTime();
    return Array.from({ length: COHORT_WEEKS }, (_, index) => {
      const start = new Date(first.getTime() + index * DAYS_IN_WEEK * MS_IN_DAY);
      const week = dayKey(start);
      const row = rows.find((candidate) => candidate.week === week);
      // The whole week must be old enough: until its last day has had N days after it the number would be low
      const lastDay = start.getTime() + (DAYS_IN_WEEK - 1) * MS_IN_DAY;
      const known = (offset: number, value: number | undefined) =>
        lastDay + offset * MS_IN_DAY <= today ? (value ?? 0) : null;
      return {
        week,
        size: row?.size ?? 0,
        d1: known(1, row?.d1),
        d7: known(7, row?.d7),
        d30: known(30, row?.d30),
      };
    });
  }

  private async lessons(): Promise<LearningStats['lessons']> {
    const rows = await this.prisma.$queryRaw<LessonRow[]>`
      SELECT l.id, l.title, l.track, count(p.user_id)::int AS completed,
        coalesce(avg(p.best_accuracy), 0)::float AS accuracy,
        coalesce(avg(p.attempts), 0)::float AS attempts
      FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id = l.id
      GROUP BY l.id, l.title, l.track, l."order"
      ORDER BY l.track, l."order"`;
    return rows.map((row, index) => {
      const previous = rows[index - 1];
      return {
        id: row.id,
        title: row.title,
        track: row.track,
        completed: row.completed,
        fromPrevious:
          previous && previous.track === row.track
            ? percent(row.completed, previous.completed)
            : null,
        // The accuracy of a run is kept between 0 and 1
        accuracy: Math.round(row.accuracy * PERCENT),
        attempts: Math.round(row.attempts * TENTH) / TENTH,
      };
    });
  }

  private themes(since: Date): Promise<LearningStats['themes']> {
    return this.prisma.$queryRaw<LearningStats['themes']>`
      SELECT t AS theme, count(*)::int AS attempts,
        count(*) FILTER (WHERE a.status = 'solved')::int AS solved
      FROM puzzle_attempts a
      JOIN puzzles p ON p.id = a.puzzle_id
      CROSS JOIN LATERAL unnest(p.themes) AS t
      WHERE a.started_at >= ${since}
      GROUP BY t HAVING count(*) >= ${MIN_THEME_ATTEMPTS}
      ORDER BY (count(*) FILTER (WHERE a.status = 'solved'))::float / count(*) ASC, count(*) DESC
      LIMIT ${WORST_THEMES}`;
  }
}
