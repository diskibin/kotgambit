import type { LearningStats } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { useAdminLearningQuery } from '../../app/api';
import { formatCount, percentOf, shortDay } from './format';
import { Caption, Cell, DataTable, FunnelBars, Loaded, Section } from './parts';

const FUNNEL_STEPS = ['registered', 'lesson', 'returned', 'solvedPuzzle', 'playedGame'] as const;

/** A share of the cohort, or a dash for a day that has not come yet for the whole week. */
function cohortShare(count: number | null, size: number): string {
  return count === null ? '—' : `${percentOf(count, size)}%`;
}

function Learning({ stats }: { stats: LearningStats }) {
  const { t } = useTranslation();
  const hasCohorts = stats.cohorts.some((cohort) => cohort.size > 0);
  return (
    <div className="grid items-start gap-6 laptop:grid-cols-2">
      <Section title={t('admin.learning.funnel.title')}>
        <Caption>{t('admin.learning.funnel.caption')}</Caption>
        <FunnelBars
          steps={FUNNEL_STEPS.map((key) => ({
            key,
            label: t(`admin.learning.funnel.${key}`),
            value: stats.funnel[key],
          }))}
          shareText={(percent) => t('admin.learning.funnel.share', { percent })}
        />
      </Section>

      <Section title={t('admin.learning.cohorts.title')}>
        <Caption>{t('admin.learning.cohorts.caption')}</Caption>
        {hasCohorts ? (
          <DataTable
            head={[
              t('admin.learning.cohorts.week'),
              t('admin.learning.cohorts.size'),
              t('admin.learning.cohorts.d1'),
              t('admin.learning.cohorts.d7'),
              t('admin.learning.cohorts.d30'),
            ]}
          >
            {stats.cohorts.map((cohort) => (
              <tr key={cohort.week}>
                <Cell>{shortDay(cohort.week)}</Cell>
                <Cell strong>{formatCount(cohort.size)}</Cell>
                <Cell>{cohortShare(cohort.d1, cohort.size)}</Cell>
                <Cell>{cohortShare(cohort.d7, cohort.size)}</Cell>
                <Cell>{cohortShare(cohort.d30, cohort.size)}</Cell>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Caption>{t('admin.learning.cohorts.none')}</Caption>
        )}
      </Section>

      <Section title={t('admin.learning.lessons.title')}>
        <Caption>{t('admin.learning.lessons.caption')}</Caption>
        {stats.lessons.length > 0 ? (
          <DataTable
            head={[
              t('admin.learning.lessons.lesson'),
              t('admin.learning.lessons.completed'),
              t('admin.learning.lessons.fromPrevious'),
              t('admin.learning.lessons.accuracy'),
              t('admin.learning.lessons.attempts'),
            ]}
          >
            {stats.lessons.map((lesson) => (
              <tr key={lesson.id}>
                <Cell>{lesson.title}</Cell>
                <Cell strong>{formatCount(lesson.completed)}</Cell>
                <Cell>{lesson.fromPrevious === null ? '—' : `${lesson.fromPrevious}%`}</Cell>
                <Cell>{lesson.completed > 0 ? `${lesson.accuracy}%` : '—'}</Cell>
                <Cell>{lesson.completed > 0 ? lesson.attempts : '—'}</Cell>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Caption>{t('admin.learning.lessons.none')}</Caption>
        )}
      </Section>

      <Section title={t('admin.learning.themes.title')}>
        <Caption>{t('admin.learning.themes.caption')}</Caption>
        {stats.themes.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {stats.themes.map((theme) => {
              const share = percentOf(theme.solved, theme.attempts);
              return (
                <li
                  key={theme.theme}
                  aria-label={t('admin.learning.themes.row', theme)}
                  className="flex items-center gap-3"
                >
                  <span aria-hidden="true" className="w-36 shrink-0 text-[14px] font-semibold">
                    {theme.theme}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-2">
                    <div
                      aria-hidden="true"
                      style={{ width: `${share}%` }}
                      className={`h-full ${share < 40 ? 'bg-coral' : 'bg-mint'}`}
                    />
                  </div>
                  <span aria-hidden="true" className="w-12 text-right text-[14px] font-bold">
                    {share}%
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Caption>{t('admin.learning.themes.none')}</Caption>
        )}
      </Section>
    </div>
  );
}

export function LearningTab({ days }: { days: number }) {
  const query = useAdminLearningQuery(days);
  return <Loaded query={query}>{(stats) => <Learning stats={stats} />}</Loaded>;
}
