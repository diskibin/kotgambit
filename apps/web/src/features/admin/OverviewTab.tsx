import type { AdminStats } from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '../../shared/ui/Tabs';
import { formatCount, formatRubles, percentOf, shortDay } from './format';
import { Caption, Cell, DataTable, FunnelBars, Section, Tile, Tiles } from './parts';

type Metric = 'visitors' | 'registrations' | 'payments';

const METRICS: readonly Metric[] = ['visitors', 'registrations', 'payments'];
const FUNNEL_STEPS = ['visitors', 'signedIn', 'premiumView', 'checkoutStart', 'paid'] as const;
// A bar of a day without anything stays a thin line, so that the days can be counted by eye
const MIN_BAR_PERCENT = 2;
const USAGE_KEYS = [
  'gamesStarted',
  'gamesFinished',
  'puzzlesStarted',
  'puzzlesSolved',
  'lessonsCompleted',
  'reviewsDone',
] as const;

function Funnel({ stats }: { stats: AdminStats }) {
  const { t } = useTranslation();
  return (
    <Section title={t('admin.funnel.title')}>
      <Caption>{t('admin.funnel.caption')}</Caption>
      <FunnelBars
        steps={FUNNEL_STEPS.map((key) => ({
          key,
          label: t(`admin.funnel.steps.${key}`),
          value: stats.funnel[key],
        }))}
        shareText={(percent) => t('admin.funnel.share', { percent })}
      />
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
          metric: t(`admin.chart.${metric}`),
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

function Nudges({ stats }: { stats: AdminStats }) {
  const { t } = useTranslation();
  return (
    <Section title={t('admin.nudges.title')}>
      <Caption>{t('admin.nudges.caption')}</Caption>
      <DataTable
        head={[
          t('admin.nudges.kind'),
          t('admin.nudges.viewed'),
          t('admin.nudges.clicked'),
          t('admin.nudges.share'),
        ]}
      >
        {stats.nudges.map((nudge) => (
          <tr key={nudge.kind}>
            <Cell>{t(`admin.nudges.kinds.${nudge.kind}`)}</Cell>
            <Cell strong>{formatCount(nudge.viewed)}</Cell>
            <Cell>{formatCount(nudge.clicked)}</Cell>
            <Cell>{nudge.viewed > 0 ? `${percentOf(nudge.clicked, nudge.viewed)}%` : '—'}</Cell>
          </tr>
        ))}
      </DataTable>
    </Section>
  );
}

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

export function OverviewTab({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid items-start gap-6 laptop:grid-cols-2">
      <Funnel stats={stats} />
      <Chart stats={stats} />
      <Users stats={stats} />
      <Premium stats={stats} />
      <Nudges stats={stats} />
      <Usage stats={stats} />
    </div>
  );
}
