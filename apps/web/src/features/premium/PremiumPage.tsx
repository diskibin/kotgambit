import { AppShell } from '../../shared/ui/AppShell';
import { formatDay } from '@kotgambit/game-player';
import type { PlanKeyValue, SubscriptionView } from '@kotgambit/contracts';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';
import {
  useCancelSubscriptionMutation,
  useCheckoutMutation,
  usePlansQuery,
  useResumeSubscriptionMutation,
  useSubscriptionQuery,
} from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { redirect } from '../../shared/redirect';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { CheckIcon } from '../../shared/ui/icons';
import { useTrack } from '../analytics/useTrack';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

const MONTHS_IN_YEAR = 12;
const TABLE_ROWS = [
  'basics',
  'tracks',
  'puzzles',
  'bots',
  'review',
  'analysis',
  'cards',
  'mistakes',
] as const;
// What a row says for a free learner and for a subscriber, keys of `premium.table.cell`
const TABLE_CELLS: Record<(typeof TABLE_ROWS)[number], readonly [string, string]> = {
  basics: ['yes', 'yes'],
  tracks: ['firstLessons', 'yes'],
  puzzles: ['puzzlesFree', 'unlimited'],
  bots: ['yes', 'yes'],
  review: ['brief', 'full'],
  analysis: ['analysisFree', 'unlimited'],
  cards: ['no', 'yes'],
  mistakes: ['no', 'yes'],
};

function Cell({ kind }: { kind: string }) {
  const { t } = useTranslation();
  if (kind === 'yes') {
    return (
      <span className="inline-flex items-center gap-1">
        <CheckIcon size={18} />
        <span className="sr-only">{t('premium.table.cell.yes')}</span>
      </span>
    );
  }
  if (kind === 'no') {
    return (
      <span>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t('premium.table.cell.no')}</span>
      </span>
    );
  }
  return <span>{t(`premium.table.cell.${kind}`)}</span>;
}

function Offer({ expired }: { expired: boolean }) {
  const { t } = useTranslation();
  const scheme = useScheme();
  const plans = usePlansQuery();
  const [checkout, order] = useCheckoutMutation();
  const track = useTrack();
  const [plan, setPlan] = useState<PlanKeyValue>('year');
  const [autoRenew, setAutoRenew] = useState(false);

  const list = plans.data?.plans ?? [];
  const monthly = list.find((item) => item.key === 'month');
  const yearly = list.find((item) => item.key === 'year');

  async function start() {
    track('checkout_start');
    const result = await checkout({ plan, client: 'web', autoRenew });
    if ('data' in result && result.data) redirect(result.data.confirmationUrl);
  }

  if (plans.data && !plans.data.available) return <Banner>{t('premium.unavailable')}</Banner>;

  return (
    <div className="grid gap-8 laptop:grid-cols-[540px_minmax(0,1fr)]">
      <section className="flex flex-col gap-4">
        <Mascot mood="proud" size={150} accessory="crown" dark={scheme === 'dark'} animate />
        <h2 className="m-0 font-heading text-[31px] leading-10 font-bold">
          {t('premium.offer.title')}
        </h2>
        <p className="m-0 text-[17px] font-semibold text-text-2">
          {expired ? t('premium.offer.expired') : t('premium.offer.text')}
        </p>

        <div
          role="radiogroup"
          aria-label={t('premium.offer.plansLabel')}
          className="flex flex-col gap-3"
        >
          {([yearly, monthly] as const).map((item) => {
            if (!item) return null;
            const selected = plan === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPlan(item.key)}
                className={`flex items-center gap-4 rounded-card border-3 p-4 text-left ${selected ? 'border-edge bg-brand-tint shadow-shashka' : 'border-line bg-surface'}`}
              >
                <span className="flex flex-1 flex-col">
                  <strong className="text-[18px]">{t(`premium.offer.${item.key}.name`)}</strong>
                  <span className="text-[15px] font-semibold text-text-2">
                    {t(`premium.offer.${item.key}.price`, { price: item.priceRub })}
                  </span>
                  <span className="text-[13px] font-semibold text-text-muted">
                    {item.key === 'year'
                      ? t('premium.offer.year.note', {
                          perMonth: Math.round(item.priceRub / MONTHS_IN_YEAR),
                        })
                      : t('premium.offer.month.note')}
                  </span>
                </span>
                {item.key === 'year' && (
                  <span className="rounded-pill bg-sun px-3 py-1 text-[13px] font-extrabold text-on-accent">
                    {t('premium.offer.year.badge')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <label className="flex min-h-11 items-center gap-3 text-[16px] font-bold">
          <input
            type="checkbox"
            className="size-5"
            checked={autoRenew}
            onChange={(event) => setAutoRenew(event.target.checked)}
          />
          {t('premium.offer.autoRenew')}
        </label>
        <p className="m-0 text-[14px] font-semibold text-text-2">
          <Trans
            i18nKey="premium.offer.terms"
            components={{
              offer: (
                <Link
                  to="/offer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-extrabold text-brand-text"
                />
              ),
            }}
          />
        </p>

        {order.isError && <Banner>{t('premium.offer.startError')}</Banner>}
        <Button large disabled={order.isLoading || !list.length} onClick={() => void start()}>
          {order.isLoading ? t('premium.offer.starting') : t('premium.offer.start')}
        </Button>
        <p className="m-0 text-[14px] font-semibold text-text-2">
          {t(plan === 'year' ? 'premium.offer.termsYear' : 'premium.offer.termsMonth')}
        </p>
      </section>

      <section aria-labelledby="table-title" className="flex flex-col gap-3">
        <h2 id="table-title" className="m-0 text-[18px] font-extrabold">
          {t('premium.table.title')}
        </h2>
        <table className="w-full border-collapse overflow-hidden rounded-card border-2 border-line text-[15px] font-semibold">
          <thead>
            <tr className="bg-surface-2 text-left">
              <th scope="col" className="p-3">
                {t('premium.table.feature')}
              </th>
              <th scope="col" className="p-3">
                {t('premium.table.free')}
              </th>
              <th scope="col" className="bg-brand-tint p-3">
                {t('premium.table.premium')}
              </th>
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row) => (
              <tr key={row} className="border-t-2 border-line">
                <th scope="row" className="p-3 text-left font-semibold">
                  {t(`premium.table.rows.${row}`)}
                </th>
                <td className="p-3">
                  <Cell kind={TABLE_CELLS[row][0]} />
                </td>
                <td className="bg-brand-tint p-3 font-bold">
                  <Cell kind={TABLE_CELLS[row][1]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Active({ subscription }: { subscription: SubscriptionView }) {
  const { t } = useTranslation();
  const scheme = useScheme();
  const [cancel, cancelling] = useCancelSubscriptionMutation();
  const end = subscription.currentPeriodEnd ? formatDay(subscription.currentPeriodEnd) : '';
  const rows: [string, string][] = [
    [t('premium.active.plan'), t(`premium.active.planName.${subscription.plan ?? 'month'}`)],
    [subscription.autoRenew ? t('premium.active.next') : t('premium.active.until'), end],
    ...(subscription.cardLast4
      ? ([
          [
            t('premium.active.card'),
            t('premium.active.cardValue', { last4: subscription.cardLast4 }),
          ],
        ] as [string, string][])
      : []),
  ];

  return (
    <section className="mx-auto flex max-w-[560px] flex-col items-center gap-4 rounded-card border-3 border-brand bg-surface p-6 text-center">
      <Mascot mood="cheer" size={120} dark={scheme === 'dark'} animate />
      <span className="rounded-pill bg-sun px-3.5 py-1 text-[14px] font-extrabold text-on-accent">
        {t('premium.active.chip')}
      </span>
      <h2 className="m-0 font-heading text-[28px] font-bold">{t('premium.active.title')}</h2>
      {subscription.status === 'past_due' && <Banner>{t('premium.active.pastDue')}</Banner>}
      <dl className="m-0 grid w-full grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-left">
        {rows.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-[15px] font-semibold text-text-2">{name}</dt>
            <dd className="m-0 text-right text-[15px] font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      {cancelling.isError && <Banner>{t('premium.active.error')}</Banner>}
      {subscription.autoRenew && (
        <Button variant="danger" disabled={cancelling.isLoading} onClick={() => void cancel()}>
          {cancelling.isLoading ? t('premium.active.cancelling') : t('premium.active.cancel')}
        </Button>
      )}
    </section>
  );
}

function Canceled({ subscription }: { subscription: SubscriptionView }) {
  const { t } = useTranslation();
  const scheme = useScheme();
  const [resume, resuming] = useResumeSubscriptionMutation();
  const date = subscription.currentPeriodEnd ? formatDay(subscription.currentPeriodEnd) : '';
  return (
    <section className="mx-auto flex max-w-[560px] flex-col items-center gap-4 rounded-card border-2 border-line bg-surface p-6 text-center">
      <Mascot mood="idle" size={120} dark={scheme === 'dark'} />
      <span className="rounded-pill bg-surface-2 px-3.5 py-1 text-[14px] font-extrabold">
        {t('premium.canceled.chip')}
      </span>
      <h2 className="m-0 font-heading text-[28px] font-bold">{t('premium.canceled.title')}</h2>
      <p className="m-0 text-[16px] font-semibold text-text-2">
        {t('premium.canceled.text', { date })}
      </p>
      <p className="m-0 w-full rounded-card bg-sky-tint p-3 text-[15px] font-semibold text-sky-text">
        {t('premium.canceled.info')}
      </p>
      {resuming.isError && <Banner>{t('premium.active.error')}</Banner>}
      <Button large disabled={resuming.isLoading} onClick={() => void resume()}>
        {resuming.isLoading ? t('premium.canceled.resuming') : t('premium.canceled.resume')}
      </Button>
    </section>
  );
}

/** The plans and what Premium opens, or what the learner has: the subscription, its end and the way to cancel. */
export function PremiumPage() {
  const { t } = useTranslation();
  const status = useAppSelector((state) => state.auth.status);
  const subscription = useSubscriptionQuery(undefined, { skip: status !== 'authenticated' });

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const data = subscription.data;
  return (
    <AppShell title={t('premium.title')}>
      <div className="mx-auto w-full max-w-[1200px]">
        {subscription.isError && (
          <div className="flex flex-col gap-3">
            <Banner>{t('premium.loadError')}</Banner>
            <Button className="self-start" onClick={() => void subscription.refetch()}>
              {t('premium.retry')}
            </Button>
          </div>
        )}
        {subscription.isLoading && (
          <p role="status" className="m-0 text-[16px] font-bold text-text-2">
            {t('premium.loading')}
          </p>
        )}
        {data && (data.status === 'active' || data.status === 'past_due') && (
          <Active subscription={data} />
        )}
        {data && data.status === 'canceled' && <Canceled subscription={data} />}
        {data && (data.status === 'none' || data.status === 'expired') && (
          <Offer expired={data.status === 'expired'} />
        )}
      </div>
    </AppShell>
  );
}
