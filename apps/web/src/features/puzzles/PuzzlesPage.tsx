import { AppShell } from '../../shared/ui/AppShell';
import { THEME_GROUPS, themeGroup, type ThemeGroup } from '@kotgambit/puzzle-player';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import {
  useDailyPuzzleQuery,
  useCardSummaryQuery,
  useEntitlementsQuery,
  usePuzzleStatsQuery,
  usePuzzleThemesQuery,
} from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { localDateKey } from '../../shared/localDate';
import { useNavLayout } from '../../shared/useNavLayout';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { Tabs } from '../../shared/ui/Tabs';
import { Mascot } from '../mascot/Mascot';
import { PremiumHint } from '../premium/PremiumHint';
import { useScheme } from '../theme/useScheme';
import { PositionPreview } from './PositionPreview';

type Filter = 'all' | ThemeGroup;

const FILTERS: readonly Filter[] = ['all', ...THEME_GROUPS];

/** The puzzle catalog: the puzzle of the day, the rating, the way back to mistakes and the themes. */
export function PuzzlesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  // On a phone the card of the day is one compact row: no cat, a smaller board
  const phone = useNavLayout() === 'bottom';
  const status = useAppSelector((state) => state.auth.status);
  const signedIn = status === 'authenticated';
  const daily = useDailyPuzzleQuery(localDateKey(), { skip: !signedIn });
  const stats = usePuzzleStatsQuery(undefined, { skip: !signedIn });
  const themes = usePuzzleThemesQuery(undefined, { skip: !signedIn });
  const entitlements = useEntitlementsQuery(undefined, { skip: !signedIn });
  const cards = useCardSummaryQuery(undefined, { skip: !signedIn });
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(
    () =>
      (themes.data?.themes ?? []).filter(
        (theme) => filter === 'all' || themeGroup(theme.key) === filter,
      ),
    [themes.data, filter],
  );

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const open = (query: string) => void navigate(`/puzzles/solve?${query}`);
  const failed = [daily, stats, themes].some((query) => query.isError);

  return (
    <AppShell active="tasks" title={t('puzzles.title')}>
      <div className="flex flex-col gap-8">
        {failed && (
          <div className="flex flex-col gap-3">
            <Banner>{t('puzzles.loadError')}</Banner>
            <Button
              className="self-start"
              onClick={() => {
                void daily.refetch();
                void stats.refetch();
                void themes.refetch();
              }}
            >
              {t('puzzles.retry')}
            </Button>
          </div>
        )}

        {(daily.isLoading || stats.isLoading || themes.isLoading) && (
          <p role="status" className="m-0 text-[16px] font-bold text-text-2">
            {t('puzzles.loading')}
          </p>
        )}

        <PremiumHint kind="puzzles" left={entitlements.data?.puzzles.left ?? null} />

        <div className="grid gap-6 laptop:grid-cols-[1.55fr_1fr]">
          {daily.data && (
            <section
              aria-labelledby="daily-title"
              className="flex flex-wrap items-center gap-4 rounded-card border-2 border-sun-border bg-sun-tint p-4 tablet:gap-6 tablet:p-6"
            >
              {!phone && <Mascot mood="hint" size={120} dark={scheme === 'dark'} />}
              <div className="flex min-w-[150px] max-w-full flex-1 flex-col items-start gap-3 tablet:min-w-[220px]">
                <span className="rounded-pill bg-sun px-3.5 py-1 text-[14px] font-extrabold text-on-accent">
                  {t('puzzles.daily.chip')}
                </span>
                <h2
                  id="daily-title"
                  className="m-0 font-heading text-[22px] leading-7 font-bold [overflow-wrap:anywhere] tablet:text-[26px] tablet:leading-9"
                >
                  {daily.data.title}
                </h2>
                <p className="m-0 text-[16px] font-semibold text-text-2">
                  {daily.data.solved
                    ? t('puzzles.daily.solved')
                    : t(`puzzles.turn.${daily.data.solver}`)}
                </p>
                {daily.data.streak > 0 && (
                  <p className="m-0 text-[15px] font-extrabold text-sun-text">
                    {t('puzzles.daily.streak', { count: daily.data.streak })}
                    {!daily.data.solved && (
                      <span className="block font-semibold text-text-2">
                        {t('puzzles.daily.keep')}
                      </span>
                    )}
                  </p>
                )}
                {daily.data.bestStreak > daily.data.streak && (
                  <p className="m-0 text-[14px] font-semibold text-text-2">
                    {t('puzzles.daily.best', { count: daily.data.bestStreak })}
                  </p>
                )}
                <Button onClick={() => open('mode=daily')}>
                  {daily.data.solved ? t('puzzles.daily.again') : t('puzzles.daily.solve')}
                </Button>
              </div>
              <PositionPreview
                fen={daily.data.fen}
                orientation={daily.data.solver}
                size={phone ? 132 : 196}
                label={t('puzzles.daily.boardLabel')}
              />
            </section>
          )}

          <div className="flex flex-col gap-4">
            {stats.data && (
              <section
                aria-labelledby="rating-title"
                className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface p-5"
              >
                <h2 id="rating-title" className="m-0 text-[16px] font-bold text-text-2">
                  {t('puzzles.rating.title')}
                </h2>
                <p className="m-0 font-heading text-[44px] leading-[52px] font-bold">
                  {stats.data.rating}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] font-bold text-text-2">
                  <span>{t('puzzles.rating.solved', { count: stats.data.solved })}</span>
                  <span>{t('puzzles.rating.best', { count: stats.data.bestStreak })}</span>
                </div>
              </section>
            )}
            <button
              type="button"
              onClick={() => open('mode=review')}
              className="flex min-h-[72px] flex-col items-start gap-1 rounded-card border-2 border-dashed border-sun-depth bg-surface p-5 text-left"
            >
              <span className="font-heading text-[18px] font-bold">
                {t('puzzles.mistakes.title')}
              </span>
              <span className="text-[15px] font-semibold text-text-2">
                {t('puzzles.mistakes.text')}
              </span>
            </button>
            {cards.data && cards.data.total > 0 && (
              <button
                type="button"
                onClick={() => void navigate('/cards')}
                className="flex min-h-[72px] flex-col items-start gap-1 rounded-card border-2 border-dashed border-sun-depth bg-surface p-5 text-left"
              >
                <span className="font-heading text-[18px] font-bold">
                  {t('puzzles.mistakes.gamesTitle')}
                </span>
                <span className="text-[15px] font-semibold text-text-2">
                  {cards.data.due > 0
                    ? t('puzzles.mistakes.gamesDue', { count: cards.data.due })
                    : t('puzzles.mistakes.gamesNone')}
                </span>
              </button>
            )}
          </div>
        </div>

        <section aria-labelledby="themes-title" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="themes-title" className="m-0 font-heading text-[24px] font-bold">
              {t('puzzles.themes.title')}
            </h2>
            <div className="w-full tablet:w-[420px]">
              <Tabs
                label={t('puzzles.themes.filterLabel')}
                tabs={FILTERS.map((id) => ({ id, label: t(`puzzles.themes.filter.${id}`) }))}
                value={filter}
                onChange={setFilter}
              />
            </div>
          </div>

          {themes.data && shown.length === 0 && (
            <p className="m-0 text-[16px] font-semibold text-text-2">{t('puzzles.themes.none')}</p>
          )}

          <ul className="m-0 grid list-none auto-rows-fr grid-cols-1 gap-4 p-0 tablet:grid-cols-2 laptop:grid-cols-4">
            {shown.map((theme) => (
              <li key={theme.key}>
                <button
                  type="button"
                  onClick={() => open(`mode=theme&theme=${encodeURIComponent(theme.key)}`)}
                  className="flex h-full min-h-[132px] w-full flex-col items-start gap-3 rounded-card border-2 border-line bg-surface p-5 text-left"
                >
                  <span className="font-heading text-[18px] leading-6 font-bold">
                    {theme.title}
                  </span>
                  <span className="text-[14px] font-bold text-text-2">
                    {t('puzzles.themes.solvedOf', { solved: theme.solved, count: theme.count })}
                  </span>
                  <span className="mt-auto flex w-full">
                    <ProgressBar
                      value={theme.solved}
                      max={theme.count}
                      label={t('puzzles.themes.progress', { title: theme.title })}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
