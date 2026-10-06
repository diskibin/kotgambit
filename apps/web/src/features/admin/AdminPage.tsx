import { STATS_PERIOD_DAYS, type AdminStats } from '@kotgambit/contracts';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { useAdminStatsQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { AppShell } from '../../shared/ui/AppShell';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Tabs } from '../../shared/ui/Tabs';
import { NotFoundPage } from '../system/NotFoundPage';
import { formatCount, formatRubles, percentOf, shortDay } from './format';

type Period = `${(typeof STATS_PERIOD_DAYS)[number]}`;
type Metric = 'visitors' | 'registrations' | 'payments';

const METRICS: readonly Metric[] = ['visitors', 'registrations', 'payments'];
const FUNNEL_STEPS = ['visitors', 'signedIn', 'premiumView', 'checkoutStart', 'paid'] as const;
const NOT_FOUND = 404;
const PERCENT_MAX = 100;
// A bar of a day without anything stays a thin line, so that the days can be counted by eye
const MIN_BAR_PERCENT = 2;

function statusOf(error: unknown): number | null {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4">
      <h2 className="m-0 text-[18px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border-2 border-line bg-surface-2 p-3">
      <span className="text-[13px] font-extrabold tracking-[0.05em] text-text-2 uppercase">
        {label}
      </span>
      <span className="font-heading text-[24px] leading-8 font-bold">{value}</span>
      {sub && <span className="text-[13px] font-semibold text-text-muted">{sub}</span>}
    </div>
  );
}

function Tiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 desktop:grid-cols-3">{children}</div>;
}

function Funnel({ stats }: { stats: AdminStats }) {
  const { t } = useTranslation();
  const { funnel } = stats;
  return (
    <Section title={t('admin.funnel.title')}>
      <p className="m-0 text-[14px] font-semibold text-text-2">{t('admin.funnel.caption')}</p>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {FUNNEL_STEPS.map((step, index) => {
          const value = funnel[step];
          const previous = index === 0 ? null : funnel[FUNNEL_STEPS[index - 1] as typeof step];
          const share = percentOf(value, funnel.visitors);
          return (
            <li key={step} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[15px] font-bold">{t(`admin.funnel.steps.${step}`)}</span>
                <span className="text-[15px] font-extrabold">{formatCount(value)}</span>
              </div>
              <div
                role="progressbar"
                aria-label={t(`admin.funnel.steps.${step}`)}
                aria-valuemin={0}
                aria-valuemax={funnel.visitors}
                aria-valuenow={value}
                className="h-3 overflow-hidden rounded-pill bg-surface-2"
              >
                <div
                  style={{ width: `${Math.min(share, PERCENT_MAX)}%` }}
                  className="h-full bg-brand"
                />
              </div>
              {index > 0 && (
                <span className="text-[13px] font-semibold text-text-2">
                  {t('admin.funnel.share', { percent: share })}
                  {previous !== null && (
                    <>
                      {' · '}
                      {t('admin.funnel.fromPrevious', { percent: percentOf(value, previous) })}
                    </>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function Users({ stats }: { stats: AdminStats }) {
  const { t } = useTranslation();
  const { users } = stats;
  return (
    <Section title={t('admin.users.title')}>
      <Tiles>
        <Tile label={t('admin.users.total')} value={formatCount(users.total)} />
        <Tile label={t('admin.users.registered')} value={formatCount(users.registered)} />
        <Tile label={t('admin.users.dau')} value={formatCount(users.dau)} />
        <Tile label={t('admin.users.wau')} value={formatCount(users.wau)} />
        <Tile label={t('admin.users.mau')} value={formatCount(users.mau)} />
        <Tile
          label={t('admin.users.stickiness')}
          value={`${percentOf(users.dau, users.mau)}%`}
          sub={t('admin.users.stickinessSub')}
        />
      </Tiles>
    </Section>
  );
}

function Chart({ stats }: { stats: AdminStats }) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<Metric>('visitors');
  const values = stats.daily.map((day) => ({ day: day.day, value: day[metric] }));
  const max = Math.max(1, ...values.map((entry) => entry.value));
  const total = values.reduce((sum, entry) => sum + entry.value, 0);
  const best = values.reduce((top, entry) => (entry.value > top.value ? entry : top), {
    day: '',
    value: -1,
  });
  const name = t(`admin.chart.${metric}`);
  const first = values[0];
  const last = values.at(-1);

  return (
    <Section title={t('admin.chart.title')}>
      <Tabs
        label={t('admin.chart.metric')}
        tabs={METRICS.map((id) => ({ id, label: t(`admin.chart.${id}`) }))}
        value={metric}
        onChange={setMetric}
      />
      <div
        role="img"
        aria-label={t('admin.chart.summary', {
          metric: name,
          total: formatCount(total),
          best: best.value >= 0 ? `${shortDay(best.day)} (${formatCount(best.value)})` : '—',
        })}
        className="flex h-40 items-end gap-px"
      >
        {values.map((entry) => (
          <div
            key={entry.day}
            title={t('admin.chart.bar', {
              day: shortDay(entry.day),
              value: formatCount(entry.value),
            })}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              style={{ height: `${Math.max(MIN_BAR_PERCENT, percentOf(entry.value, max))}%` }}
              className={`w-full rounded-t-[3px] ${entry.value > 0 ? 'bg-brand' : 'bg-line'}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[13px] font-bold text-text-2">
        <span>{first ? shortDay(first.day) : ''}</span>
        <span>{last ? shortDay(last.day) : ''}</span>
      </div>
    </Section>
  );
}

function Premium({ stats }: { stats: AdminStats }) {
  const { t } = useTranslation();
  const { premium } = stats;
  return (
    <Section title={t('admin.premium.title')}>
      <Tiles>
        <Tile label={t('admin.premium.active')} value={formatCount(premium.active)} />
        <Tile
          label={t('admin.premium.plans')}
          value={`${formatCount(premium.month)} / ${formatCount(premium.year)}`}
        />
        <Tile label={t('admin.premium.autoRenew')} value={formatCount(premium.autoRenew)} />
        <Tile label={t('admin.premium.canceledPaid')} value={formatCount(premium.canceledPaid)} />
        <Tile label={t('admin.premium.newInPeriod')} value={formatCount(premium.newInPeriod)} />
        <Tile label={t('admin.premium.renewals')} value={formatCount(premium.renewalsInPeriod)} />
        <Tile label={t('admin.premium.failed')} value={formatCount(premium.failedPayments)} />
        <Tile label={t('admin.premium.revenue')} value={formatRubles(premium.revenueKopecks)} />
        <Tile
          label={t('admin.premium.totalRevenue')}
          value={formatRubles(premium.totalRevenueKopecks)}
        />
      </Tiles>
    </Section>
  );
}

const USAGE_KEYS = [
  'gamesStarted',
  'gamesFinished',
  'puzzlesStarted',
  'puzzlesSolved',
  'lessonsCompleted',
  'reviewsDone',
] as const;

function Usage({ stats }: { stats: AdminStats }) {
  const { t } = useTranslation();
  return (
    <Section title={t('admin.usage.title')}>
      <Tiles>
        {USAGE_KEYS.map((key) => (
          <Tile key={key} label={t(`admin.usage.${key}`)} value={formatCount(stats.usage[key])} />
        ))}
      </Tiles>
    </Section>
  );
}

/** The numbers of the site for its owner: the funnel, the people, the money and what they do. */
export function AdminPage() {
  const { t } = useTranslation();
  const status = useAppSelector((state) => state.auth.status);
  const [period, setPeriod] = useState<Period>('30');
  const stats = useAdminStatsQuery(Number(period), { skip: status !== 'authenticated' });

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  // The server answers 404 to everybody who is not in the list, and so does the page
  if (statusOf(stats.error) === NOT_FOUND) return <NotFoundPage />;

  return (
    <AppShell active="profile" title={t('admin.title')}>
      <div className="flex flex-col gap-6">
        <Tabs
          label={t('admin.period')}
          tabs={STATS_PERIOD_DAYS.map((days) => ({
            id: String(days) as Period,
            label: t('admin.days', { count: days }),
          }))}
          value={period}
          onChange={setPeriod}
        />

        {stats.isError && (
          <div className="flex flex-col gap-3">
            <Banner>{t('admin.loadError')}</Banner>
            <Button className="self-start" onClick={() => void stats.refetch()}>
              {t('admin.retry')}
            </Button>
          </div>
        )}
        {stats.isLoading && (
          <p role="status" className="m-0 text-[16px] font-bold text-text-2">
            {t('admin.loading')}
          </p>
        )}

        {stats.data && (
          <div className="grid items-start gap-6 laptop:grid-cols-2">
            <Funnel stats={stats.data} />
            <Chart stats={stats.data} />
            <Users stats={stats.data} />
            <Premium stats={stats.data} />
            <Usage stats={stats.data} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
