import type { PaymentsStats } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { useAdminPaymentsQuery } from '../../app/api';
import { formatCount, formatRubles, percentOf } from './format';
import { Caption, Cell, DataTable, Loaded, Section, Tile, Tiles } from './parts';

/** Day and time of a payment in the viewer's own zone, which is what the owner compares with the bank. */
export function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Payments({ stats }: { stats: PaymentsStats }) {
  const { t, i18n } = useTranslation();
  // A code the page has no words for is shown as it came
  const reason = (code: string) =>
    i18n.exists(`admin.payments.failures.reason.${code}`)
      ? t(`admin.payments.failures.reason.${code}`)
      : code;
  return (
    <div className="grid items-start gap-6 laptop:grid-cols-2">
      <Section title={t('admin.payments.plans.title')}>
        <Caption>{t('admin.payments.plans.caption')}</Caption>
        <DataTable
          head={[
            '',
            t('admin.payments.plans.started'),
            t('admin.payments.plans.paid'),
            t('admin.payments.plans.conversion'),
          ]}
        >
          {stats.byPlan.map((row) => (
            <tr key={row.plan}>
              <Cell strong>{t(`admin.payments.plans.plan.${row.plan}`)}</Cell>
              <Cell>{formatCount(row.started)}</Cell>
              <Cell>{formatCount(row.paid)}</Cell>
              <Cell>{row.started > 0 ? `${percentOf(row.paid, row.started)}%` : '—'}</Cell>
            </tr>
          ))}
        </DataTable>
        <Tiles>
          <Tile
            label={t('admin.payments.churned')}
            value={formatCount(stats.churned)}
            sub={t('admin.payments.churnedSub')}
          />
          <Tile
            label={t('admin.payments.pastDue')}
            value={formatCount(stats.pastDue)}
            sub={t('admin.payments.pastDueSub')}
          />
        </Tiles>
      </Section>

      <Section title={t('admin.payments.failures.title')}>
        {stats.failures.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {stats.failures.map((failure) => (
              <li key={failure.reason} className="flex justify-between gap-3 text-[15px]">
                <span className="font-semibold">{reason(failure.reason)}</span>
                <span className="font-extrabold">{formatCount(failure.count)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Caption>{t('admin.payments.failures.none')}</Caption>
        )}
      </Section>

      <div className="laptop:col-span-2">
        <Section title={t('admin.payments.recent.title')}>
          {stats.recent.length > 0 ? (
            <DataTable
              head={[
                t('admin.payments.recent.date'),
                t('admin.payments.recent.who'),
                t('admin.payments.recent.what'),
                t('admin.payments.recent.amount'),
                t('admin.payments.recent.status'),
              ]}
            >
              {stats.recent.map((row) => (
                <tr key={row.id}>
                  <Cell>{formatMoment(row.createdAt)}</Cell>
                  <Cell>{row.email}</Cell>
                  <Cell>
                    {t(`admin.payments.recent.purpose.${row.purpose}`)},{' '}
                    {t(`admin.payments.plans.plan.${row.plan}`).toLowerCase()} · {row.client}
                  </Cell>
                  <Cell strong>{formatRubles(row.amountKopecks)}</Cell>
                  <Cell>
                    {t(`admin.payments.recent.statuses.${row.status}`)}
                    {row.cancelReason && ` · ${reason(row.cancelReason)}`}
                  </Cell>
                </tr>
              ))}
            </DataTable>
          ) : (
            <Caption>{t('admin.payments.recent.none')}</Caption>
          )}
        </Section>
      </div>
    </div>
  );
}

export function PaymentsTab({ days }: { days: number }) {
  const query = useAdminPaymentsQuery(days);
  return <Loaded query={query}>{(stats) => <Payments stats={stats} />}</Loaded>;
}
