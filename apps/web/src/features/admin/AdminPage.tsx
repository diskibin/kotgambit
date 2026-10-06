import { STATS_PERIOD_DAYS } from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { useAdminStatsQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { AppShell } from '../../shared/ui/AppShell';
import { Tabs } from '../../shared/ui/Tabs';
import { NotFoundPage } from '../system/NotFoundPage';
import { LearningTab } from './LearningTab';
import { OverviewTab } from './OverviewTab';
import { Loaded, statusOf } from './parts';
import { PaymentsTab } from './PaymentsTab';
import { ServerTab } from './ServerTab';
import { UsersTab } from './UsersTab';

type Period = `${(typeof STATS_PERIOD_DAYS)[number]}`;
type Section = 'overview' | 'learning' | 'payments' | 'server' | 'users';

const SECTIONS: readonly Section[] = ['overview', 'learning', 'payments', 'server', 'users'];
// The server and the accounts are as they are now, a period means nothing to them
const WITH_PERIOD: readonly Section[] = ['overview', 'learning', 'payments'];
const NOT_FOUND = 404;

/** The numbers of the site for its owner, and the few things the owner may change. */
export function AdminPage() {
  const { t } = useTranslation();
  const status = useAppSelector((state) => state.auth.status);
  const [section, setSection] = useState<Section>('overview');
  const [period, setPeriod] = useState<Period>('30');
  const days = Number(period);
  // Also the gate: the server answers 404 to everybody who is not in the list, whatever the tab
  const stats = useAdminStatsQuery(days, { skip: status !== 'authenticated' });

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (statusOf(stats.error) === NOT_FOUND) return <NotFoundPage />;

  return (
    <AppShell active="profile" title={t('admin.title')}>
      <div className="flex flex-col gap-6">
        <Tabs
          label={t('admin.sections.label')}
          tabs={SECTIONS.map((id) => ({ id, label: t(`admin.sections.${id}`) }))}
          value={section}
          onChange={setSection}
        />
        {WITH_PERIOD.includes(section) && (
          <Tabs
            label={t('admin.period')}
            tabs={STATS_PERIOD_DAYS.map((count) => ({
              id: String(count) as Period,
              label: t('admin.days', { count }),
            }))}
            value={period}
            onChange={setPeriod}
          />
        )}

        {section === 'overview' && (
          <Loaded query={stats}>{(data) => <OverviewTab stats={data} />}</Loaded>
        )}
        {section === 'learning' && <LearningTab days={days} />}
        {section === 'payments' && <PaymentsTab days={days} />}
        {section === 'server' && <ServerTab />}
        {section === 'users' && <UsersTab />}
      </div>
    </AppShell>
  );
}
