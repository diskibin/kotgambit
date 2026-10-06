import { DAILY_GOAL_MINUTES } from '@kotgambit/contracts';
import {
  BOARD_THEMES,
  PIECE_SETS,
  type BoardTheme,
  type PieceSet,
  type ThemePreference,
} from '@kotgambit/preferences';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import {
  useDeleteAccountMutation,
  useLazyExportDataQuery,
  useLogoutMutation,
  useMeQuery,
  useSettingsQuery,
  useSubscriptionQuery,
  useUpdateSettingsMutation,
} from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Tabs } from '../../shared/ui/Tabs';
import { AppShell } from '../../shared/ui/AppShell';
import { Mascot } from '../mascot/Mascot';
import { preferenceChanged } from '../theme/theme.slice';
import { useScheme } from '../theme/useScheme';
import { BOARD_COLORS } from './boardThemes';
import {
  boardThemeChanged,
  coordinatesChanged,
  pieceSetChanged,
  reduceMotionChanged,
} from './ui.slice';
import { pieceUrl } from '../board/pieceAssets';
import { downloadJson } from '../../shared/download';

const THEME_CHOICES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const PREVIEW_CELLS = 4;

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border-2 border-line bg-surface p-5">
      <h2 className="m-0 font-heading text-[18px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Switch({
  label,
  text,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 items-center gap-3 rounded-card border-2 border-line bg-surface p-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex flex-1 flex-col">
        <strong className="text-[16px]">{label}</strong>
        <span className="text-[14px] font-semibold text-text-2">{text}</span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-7 w-12 shrink-0 items-center rounded-pill border-2 border-edge px-0.5 ${checked ? 'justify-end bg-brand' : 'justify-start bg-line'}`}
      >
        <span className="size-5 rounded-full border-2 border-edge bg-white" />
      </span>
    </button>
  );
}

/** A small board in the colors of a theme, 4 by 4 squares. */
function BoardPreview({ theme }: { theme: BoardTheme }) {
  const colors =
    theme === 'gambit'
      ? { light: 'var(--color-board-b)', dark: 'var(--color-board-a)' }
      : BOARD_COLORS[theme];
  return (
    <span
      aria-hidden="true"
      className="grid size-24 overflow-hidden rounded-[10px] border-2 border-edge"
      style={{ gridTemplateColumns: `repeat(${PREVIEW_CELLS}, 1fr)` }}
    >
      {Array.from({ length: PREVIEW_CELLS * PREVIEW_CELLS }, (_, index) => {
        const light = (Math.floor(index / PREVIEW_CELLS) + index) % 2 === 0;
        return <span key={index} style={{ background: light ? colors.light : colors.dark }} />;
      })}
    </span>
  );
}

// A king, a knight and a pawn, white and black, as small as on a board
const PREVIEW_PIECES = [
  { color: 'w', type: 'k' },
  { color: 'b', type: 'n' },
  { color: 'w', type: 'p' },
] as const;

/** The look of a set of pieces. */
function PiecePreview({ set }: { set: PieceSet }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[10px] bg-board-b"
    >
      {PREVIEW_PIECES.map(({ color, type }) => (
        <img
          key={`${color}${type}`}
          src={pieceUrl(color, type, set)}
          alt=""
          // Shrinks with the card instead of pushing the pieces out of it
          className="aspect-square min-w-0 max-w-12 flex-1"
        />
      ))}
    </span>
  );
}

/** Looks, board, the goal of the day and the account: what the learner can change, and the way out. */
export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const scheme = useScheme();
  const status = useAppSelector((state) => state.auth.status);
  const signedIn = status === 'authenticated';
  const theme = useAppSelector((state) => state.theme.preference);
  const ui = useAppSelector((state) => state.ui);
  const me = useMeQuery(undefined, { skip: !signedIn });
  const settings = useSettingsQuery(undefined, { skip: !signedIn });
  const subscription = useSubscriptionQuery(undefined, { skip: !signedIn });
  const [updateSettings, updating] = useUpdateSettingsMutation();
  const [exportData, exporting] = useLazyExportDataQuery();
  const [logout] = useLogoutMutation();
  const [deleteAccount, deleting] = useDeleteAccountMutation();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const word = t('settings.delete.word');
  const premium = subscription.data?.premium === true;

  async function download() {
    const result = await exportData();
    if (result.data)
      downloadJson(`kotgambit-${new Date().toISOString().slice(0, 10)}.json`, result.data);
  }

  async function remove() {
    const result = await deleteAccount();
    // The account is gone, so is the session: signing out only clears what this device still holds
    if (!('error' in result)) {
      await logout();
      void navigate('/login', { replace: true });
    }
  }

  return (
    <AppShell active="profile" title={t('settings.title')}>
      {settings.isError && (
        <div className="flex flex-col gap-3">
          <Banner>{t('settings.loadError')}</Banner>
          <Button className="self-start" onClick={() => void settings.refetch()}>
            {t('settings.retry')}
          </Button>
        </div>
      )}

      <div className="grid gap-6 laptop:grid-cols-2">
        <Card title={t('settings.board.title')}>
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-extrabold">{t('settings.board.theme')}</span>
            <div
              role="radiogroup"
              aria-label={t('settings.board.theme')}
              className="grid grid-cols-2 gap-3 tablet:grid-cols-4"
            >
              {BOARD_THEMES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={ui.boardTheme === choice}
                  onClick={() => dispatch(boardThemeChanged(choice))}
                  className={`flex flex-col items-center gap-2 rounded-card border-2 p-2 text-[14px] font-extrabold ${ui.boardTheme === choice ? 'border-brand bg-brand-tint' : 'border-line bg-surface'}`}
                >
                  <BoardPreview theme={choice} />
                  {t(`settings.board.themes.${choice}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-extrabold">{t('settings.board.pieces')}</span>
            <div
              role="radiogroup"
              aria-label={t('settings.board.pieces')}
              className="grid grid-cols-2 gap-3 tablet:grid-cols-4"
            >
              {PIECE_SETS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={ui.pieceSet === choice}
                  onClick={() => dispatch(pieceSetChanged(choice))}
                  className={`flex min-w-0 flex-col items-center gap-2 rounded-card border-2 p-2 text-[14px] font-extrabold ${ui.pieceSet === choice ? 'border-brand bg-brand-tint' : 'border-line bg-surface'}`}
                >
                  <PiecePreview set={choice} />
                  {t(`settings.board.pieceSets.${choice}`)}
                </button>
              ))}
            </div>
          </div>
          <Switch
            label={t('settings.board.coordinates.title')}
            text={t('settings.board.coordinates.text')}
            checked={ui.coordinates}
            onChange={(value) => dispatch(coordinatesChanged(value))}
          />
        </Card>

        <Card title={t('settings.appearance.title')}>
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-extrabold">{t('settings.appearance.theme')}</span>
            <div
              role="radiogroup"
              aria-label={t('settings.appearance.theme')}
              className="grid grid-cols-3 gap-3"
            >
              {THEME_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={theme === choice}
                  onClick={() => dispatch(preferenceChanged(choice))}
                  className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-card border-2 p-2 text-[15px] font-extrabold ${theme === choice ? 'border-brand bg-brand-tint' : 'border-line bg-surface'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-6 w-12 rounded-[8px] border-2 border-edge ${choice === 'dark' ? 'bg-ink' : choice === 'light' ? 'bg-white' : 'bg-gradient-to-r from-white to-ink'}`}
                  />
                  {t(`settings.appearance.${choice}`)}
                </button>
              ))}
            </div>
          </div>
          <Switch
            label={t('settings.appearance.reduce.title')}
            text={t('settings.appearance.reduce.text')}
            checked={ui.reduceMotion}
            onChange={(value) => dispatch(reduceMotionChanged(value))}
          />
        </Card>

        <Card title={t('settings.goal.title')}>
          <Tabs
            label={t('settings.goal.title')}
            tabs={DAILY_GOAL_MINUTES.map((minutes) => ({
              id: String(minutes),
              label: t('settings.goal.minutes', { count: minutes }),
            }))}
            value={String(settings.data?.dailyGoalMinutes ?? 10)}
            onChange={(id) => void updateSettings({ dailyGoalMinutes: Number(id) as 5 | 10 | 15 })}
          />
          <Switch
            label={t('settings.reminders.title')}
            text={
              me.data && !me.data.emailVerified
                ? t('settings.reminders.needVerify')
                : t('settings.reminders.text')
            }
            checked={settings.data?.reminders ?? false}
            disabled={!me.data?.emailVerified}
            onChange={(reminders) => void updateSettings({ reminders })}
          />
          {updating.isError && <Banner>{t('settings.goal.error')}</Banner>}
        </Card>

        <Card title={t('settings.account.title')}>
          <dl className="m-0 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 text-[15px]">
            <dt className="font-semibold text-text-2">{t('settings.account.email')}</dt>
            <dd className="m-0 font-bold">
              {me.data?.email}
              <span className="ml-2 font-semibold text-text-2">
                ·{' '}
                {me.data?.emailVerified
                  ? t('settings.account.verified')
                  : t('settings.account.unverified')}
              </span>
            </dd>
            <dd className="m-0" />
            <dt className="font-semibold text-text-2">{t('settings.account.password')}</dt>
            <dd className="m-0 text-[14px] font-semibold text-text-2">
              {t('settings.account.passwordText')}
            </dd>
            <dd className="m-0">
              <Button variant="text" onClick={() => void navigate('/reset')}>
                {t('settings.account.change')}
              </Button>
            </dd>
            <dt className="font-semibold text-text-2">{t('settings.account.subscription')}</dt>
            <dd className="m-0 font-bold">
              {premium ? t('settings.account.premium') : t('settings.account.free')}
            </dd>
            <dd className="m-0">
              <Button variant="text" onClick={() => void navigate('/premium')}>
                {t('settings.account.manage')}
              </Button>
            </dd>
          </dl>
          <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
            <strong className="text-[16px]">{t('settings.export.title')}</strong>
            <span className="text-[14px] font-semibold text-text-2">
              {t('settings.export.text')}
            </span>
            {exporting.isError && <Banner>{t('settings.export.error')}</Banner>}
            <Button
              variant="secondary"
              className="self-start"
              disabled={exporting.isFetching}
              onClick={() => void download()}
            >
              {t('settings.export.button')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void logout()}>
              {t('settings.account.signOut')}
            </Button>
            <Button variant="caution" onClick={() => setConfirming(true)}>
              {t('settings.account.delete')}
            </Button>
          </div>
        </Card>
      </div>

      {confirming && (
        <Dialog label={t('settings.delete.title')} onClose={() => setConfirming(false)}>
          <Mascot mood="oops" size={130} dark={scheme === 'dark'} />
          <h2 className="m-0 font-heading text-[24px] leading-8 font-bold">
            {t('settings.delete.title')}
          </h2>
          <p className="m-0 text-[16px] font-semibold text-text-2">{t('settings.delete.text')}</p>
          <label className="flex w-full flex-col gap-1 text-left text-[14px] font-bold">
            {t('settings.delete.confirmLabel')}
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="h-12 rounded-input border-2 border-line bg-surface px-3.5 text-[16px] font-medium"
            />
          </label>
          {deleting.isError && <Banner>{t('settings.delete.error')}</Banner>}
          <Button large fullWidth onClick={() => setConfirming(false)} data-autofocus>
            {t('settings.delete.keep')}
          </Button>
          <Button
            variant="danger"
            disabled={typed.trim().toLowerCase() !== word || deleting.isLoading}
            onClick={() => void remove()}
          >
            {t('settings.delete.confirm')}
          </Button>
        </Dialog>
      )}
    </AppShell>
  );
}
