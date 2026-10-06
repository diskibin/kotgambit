import { MAX_GRANT_DAYS, MIN_REASON_LENGTH, USER_SEARCH_MIN_LENGTH } from '@kotgambit/contracts';
import type { AdminUser } from '@kotgambit/contracts';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAdminUserQuery,
  useAdminUsersQuery,
  useGrantPremiumMutation,
  useRevokePremiumMutation,
} from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { TextField } from '../../shared/ui/TextField';
import { formatCount, formatRubles } from './format';
import { Caption, Cell, DataTable, Loaded, Section, Tile, Tiles } from './parts';
import { formatMoment } from './PaymentsTab';

const DEFAULT_GRANT_DAYS = 30;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');

function Grant({ user }: { user: AdminUser }) {
  const { t } = useTranslation();
  const [grant, granting] = useGrantPremiumMutation();
  const [days, setDays] = useState(String(DEFAULT_GRANT_DAYS));
  const [reason, setReason] = useState('');
  const count = Number(days);
  const valid =
    Number.isInteger(count) &&
    count >= 1 &&
    count <= MAX_GRANT_DAYS &&
    reason.trim().length >= MIN_REASON_LENGTH;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await grant({ id: user.id, days: count, reason: reason.trim() });
    if (!('error' in result)) setReason('');
  }

  return (
    <Section title={t('admin.accounts.grant.title')}>
      <Caption>{t('admin.accounts.grant.text')}</Caption>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <TextField
          label={t('admin.accounts.grant.days')}
          type="number"
          min={1}
          max={MAX_GRANT_DAYS}
          value={days}
          onChange={(event) => setDays(event.target.value)}
        />
        <TextField
          label={t('admin.accounts.grant.reason')}
          hint={t('admin.accounts.grant.reasonHint')}
          value={reason}
          maxLength={200}
          onChange={(event) => setReason(event.target.value)}
        />
        {granting.isError && <Banner>{t('admin.accounts.grant.error')}</Banner>}
        <Button type="submit" className="self-start" disabled={!valid || granting.isLoading}>
          {t('admin.accounts.grant.submit')}
        </Button>
      </form>
    </Section>
  );
}

function Revoke({ user }: { user: AdminUser }) {
  const { t } = useTranslation();
  const [revoke, revoking] = useRevokePremiumMutation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= MIN_REASON_LENGTH;

  async function confirm() {
    const result = await revoke({ id: user.id, reason: reason.trim() });
    if (!('error' in result)) {
      setOpen(false);
      setReason('');
    }
  }

  return (
    <Section title={t('admin.accounts.revoke.title')}>
      <Caption>{t('admin.accounts.revoke.text')}</Caption>
      <Button
        variant="caution"
        className="self-start"
        disabled={!user.subscription?.premium}
        onClick={() => setOpen(true)}
      >
        {t('admin.accounts.revoke.open')}
      </Button>
      {open && (
        <Dialog label={t('admin.accounts.revoke.confirmTitle')} onClose={() => setOpen(false)}>
          <h2 className="m-0 font-heading text-[22px] leading-8 font-bold">
            {t('admin.accounts.revoke.confirmTitle')}
          </h2>
          <p className="m-0 text-[15px] font-semibold text-text-2">
            {t('admin.accounts.revoke.confirmText')}
          </p>
          <div className="w-full text-left">
            <TextField
              label={t('admin.accounts.grant.reason')}
              hint={t('admin.accounts.grant.reasonHint')}
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {revoking.isError && <Banner>{t('admin.accounts.revoke.error')}</Banner>}
          <Button large fullWidth onClick={() => setOpen(false)} data-autofocus>
            {t('admin.accounts.revoke.keep')}
          </Button>
          <Button
            variant="danger"
            disabled={!valid || revoking.isLoading}
            onClick={() => void confirm()}
          >
            {t('admin.accounts.revoke.confirm')}
          </Button>
        </Dialog>
      )}
    </Section>
  );
}

function Card({ user }: { user: AdminUser }) {
  const { t } = useTranslation();
  const { subscription } = user;
  const signIn = [
    ...(user.hasPassword ? [t('admin.accounts.card.password')] : []),
    ...user.providers,
  ];
  return (
    <div className="grid items-start gap-6 laptop:grid-cols-2">
      <Section title={user.email}>
        <Caption>
          {user.displayName ? `${user.displayName} · ` : ''}
          {user.emailVerified
            ? t('admin.accounts.card.verified')
            : t('admin.accounts.card.unverified')}
        </Caption>
        <Tiles>
          <Tile label={t('admin.accounts.card.joined')} value={formatDate(user.createdAt)} />
          <Tile
            label={t('admin.accounts.card.lastActive')}
            value={
              user.lastActiveDay ? formatDate(user.lastActiveDay) : t('admin.accounts.card.never')
            }
          />
          <Tile label={t('admin.accounts.card.xp')} value={formatCount(user.xpTotal)} />
          <Tile
            label={t('admin.accounts.card.lessons')}
            value={formatCount(user.lessonsCompleted)}
          />
          <Tile label={t('admin.accounts.card.puzzles')} value={formatCount(user.puzzlesSolved)} />
          <Tile label={t('admin.accounts.card.games')} value={formatCount(user.gamesPlayed)} />
        </Tiles>
        <Caption>
          {t('admin.accounts.card.signIn')}: {signIn.join(', ') || '—'}
        </Caption>
        <p className="m-0 text-[15px] font-bold">
          {t('admin.accounts.card.subscription')}:{' '}
          {subscription
            ? [
                t(`admin.accounts.card.statusLabel.${subscription.status}`),
                t('admin.accounts.card.until', { date: formatDate(subscription.currentPeriodEnd) }),
                subscription.autoRenew && t('admin.accounts.card.autoRenew'),
                subscription.cardLast4 &&
                  t('admin.accounts.card.card', { last4: subscription.cardLast4 }),
              ]
                .filter(Boolean)
                .join(' · ')
            : t('admin.accounts.card.noSubscription')}
        </p>
      </Section>

      <div className="flex flex-col gap-6">
        <Grant user={user} />
        <Revoke user={user} />
      </div>

      <Section title={t('admin.accounts.card.payments')}>
        {user.payments.length > 0 ? (
          <DataTable
            head={[
              t('admin.payments.recent.date'),
              t('admin.payments.recent.what'),
              t('admin.payments.recent.amount'),
              t('admin.payments.recent.status'),
            ]}
          >
            {user.payments.map((payment) => (
              <tr key={payment.id}>
                <Cell>{formatMoment(payment.createdAt)}</Cell>
                <Cell>
                  {t(`admin.payments.recent.purpose.${payment.purpose}`)},{' '}
                  {t(`admin.payments.plans.plan.${payment.plan}`).toLowerCase()}
                </Cell>
                <Cell strong>{formatRubles(payment.amountKopecks)}</Cell>
                <Cell>{t(`admin.payments.recent.statuses.${payment.status}`)}</Cell>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Caption>{t('admin.accounts.card.noPayments')}</Caption>
        )}
      </Section>

      <Section title={t('admin.accounts.card.actions')}>
        {user.actions.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {user.actions.map((action) => (
              <li key={`${action.createdAt}${action.action}`} className="text-[14px] font-semibold">
                <strong>{formatMoment(action.createdAt)}</strong>{' '}
                {t(`admin.accounts.card.action.${action.action}`)} · {action.details} ·{' '}
                <span className="text-text-2">{action.adminEmail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Caption>{t('admin.accounts.card.noActions')}</Caption>
        )}
      </Section>
    </div>
  );
}

function Account({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const query = useAdminUserQuery(id);
  return (
    <div className="flex flex-col gap-6">
      <Button className="self-start" variant="secondary" onClick={onBack}>
        {t('admin.accounts.card.back')}
      </Button>
      <Loaded query={query}>{(user) => <Card user={user} />}</Loaded>
    </div>
  );
}

/** Looking an account up by its email: what it did, what it paid, and the two things an admin may change. */
export function UsersTab() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const found = useAdminUsersQuery(query, { skip: query.length < USER_SEARCH_MIN_LENGTH });

  if (selected) return <Account id={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
        }}
        className="flex max-w-[560px] items-end gap-3"
      >
        <div className="min-w-0 flex-1">
          <TextField
            label={t('admin.accounts.search.label')}
            hint={t('admin.accounts.search.hint')}
            value={draft}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={draft.trim().length < USER_SEARCH_MIN_LENGTH}>
          {t('admin.accounts.search.submit')}
        </Button>
      </form>

      {query.length >= USER_SEARCH_MIN_LENGTH && (
        <Loaded query={found}>
          {({ users }) =>
            users.length > 0 ? (
              <ul className="m-0 flex max-w-[560px] list-none flex-col gap-2 p-0">
                {users.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(user.id)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-card border-2 border-line bg-surface px-4 py-2 text-left hover:bg-surface-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <strong className="truncate text-[16px]">{user.email}</strong>
                        <span className="text-[13px] font-semibold text-text-2">
                          {formatDate(user.createdAt)}
                        </span>
                      </span>
                      {user.premium && (
                        <span className="shrink-0 rounded-pill border-2 border-edge bg-sun px-3 py-1 text-[13px] font-extrabold text-on-accent">
                          {t('admin.accounts.search.premium')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Caption>{t('admin.accounts.search.none')}</Caption>
            )
          }
        </Loaded>
      )}
    </div>
  );
}
