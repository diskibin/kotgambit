import { formatDay } from '@kotgambit/game-player';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';
import { useMeQuery, useProgressQuery, useSubscriptionQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { VerifyEmailReminder } from '../../features/auth/VerifyEmailReminder';
import { DayBar } from '../../features/path/DayBar';
import { Mascot } from '../../features/mascot/Mascot';
import { useScheme } from '../../features/theme/useScheme';
import { localDateKey } from '../localDate';
import { useNavLayout, type NavLayout } from '../useNavLayout';
import type { ReactNode } from 'react';

export type NavId = 'path' | 'tasks' | 'play' | 'analysis' | 'profile';

// The icons of the design (AppNav.dc.html), drawn in a 24 by 24 box with a 2.4 stroke
const ITEMS: readonly { id: NavId; to: string; icon: string }[] = [
  {
    id: 'path',
    to: '/learn',
    icon: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20M9 8h7M9 12h5',
  },
  {
    id: 'tasks',
    to: '/puzzles',
    icon: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
  },
  {
    id: 'play',
    to: '/play',
    icon: 'M12 3.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM8 21h8M8.5 21c0-4 1.5-7.5 3.5-9 2 1.5 3.5 5 3.5 9M9.5 12h5',
  },
  {
    id: 'analysis',
    to: '/analysis',
    icon: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16.5 16.5L21 21M8.5 13v-2M11 13V9M13.5 13v-3',
  },
  {
    id: 'profile',
    to: '/profile',
    icon: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6',
  },
];
const CROWN = 'M4 18h16M4.5 15L3.5 7l5 4 3.5-6 3.5 6 5-4-1 8z';

function Icon({ path, size, stroke = 2.4 }: { path: string; size: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** The Premium card of the design: what the learner has, or what they could have, with the way to the page. */
export function PremiumCard({
  premium,
  until,
  className = '',
}: {
  premium: boolean;
  /** The end of the paid period, when there is one to say. */
  until: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-col gap-2.5 rounded-[24px] border-2 border-edge p-5 text-on-accent shadow-shashka ${premium ? 'bg-mint' : 'bg-sun'} ${className}`}
    >
      <span className="inline-flex h-7 items-center gap-1.5 self-start rounded-pill bg-white px-2.5 text-[13px] font-extrabold">
        <Icon path={CROWN} size={14} stroke={2.8} />
        {t('nav.premium.chip')}
      </span>
      <b className="text-[18px] leading-6">
        {t(premium ? 'nav.premium.active.title' : 'nav.premium.title')}
      </b>
      {premium && until && (
        <span className="text-[14px] leading-5 font-bold">
          {t('nav.premium.active.until', { date: formatDay(until) })}
        </span>
      )}
      {!premium && <span className="text-[14px] leading-5 font-bold">{t('nav.premium.text')}</span>}
      <Link
        to="/premium"
        className="flex h-11 items-center justify-center rounded-[12px] border-2 border-edge bg-white text-[16px] font-extrabold text-on-accent no-underline shadow-shashka"
      >
        {t(premium ? 'nav.premium.active.manage' : 'nav.premium.more')}
      </Link>
    </div>
  );
}

function SideNav({
  active,
  layout,
  premium,
  until,
}: {
  active: NavId | null;
  layout: NavLayout;
  premium: boolean;
  /** The end of the paid period, when there is one to say. */
  until: string | null;
}) {
  const { t } = useTranslation();
  const scheme = useScheme();
  const compact = layout === 'compact';
  return (
    <nav
      aria-label={t('nav.label')}
      className={`sticky top-0 flex h-screen shrink-0 flex-col gap-2 border-r-2 border-line bg-surface ${compact ? 'w-[88px] items-center px-3.5 py-5' : 'w-[264px] px-5 py-6'}`}
    >
      <Link
        to="/learn"
        aria-label={t('nav.brand')}
        className="flex items-center gap-2.5 px-1 pb-5 text-text no-underline"
      >
        <Mascot mood="idle" size={48} dark={scheme === 'dark'} />
        {!compact && <b className="font-heading text-[19px] font-bold">{t('nav.brand')}</b>}
      </Link>
      {ITEMS.map((item) => {
        const on = item.id === active;
        return (
          <NavLink
            key={item.id}
            to={item.to}
            aria-current={on ? 'page' : undefined}
            aria-label={t(`nav.${item.id}`)}
            title={t(`nav.${item.id}`)}
            className={`flex h-14 items-center gap-3.5 rounded-[16px] border-2 text-[18px] font-extrabold no-underline ${compact ? 'w-14 justify-center' : 'px-4'} ${on ? 'border-brand bg-brand-tint text-brand-text' : 'border-transparent text-text-2 hover:bg-surface-2'}`}
          >
            <Icon path={item.icon} size={26} />
            {!compact && t(`nav.${item.id}`)}
          </NavLink>
        );
      })}
      {premium &&
        (compact ? (
          <Link
            to="/premium"
            aria-label={t('nav.premium.active.title')}
            title={t('nav.premium.active.title')}
            className="mt-auto flex size-14 items-center justify-center rounded-[16px] border-2 border-edge bg-mint text-on-accent shadow-shashka"
          >
            <Icon path={CROWN} size={26} stroke={2.6} />
          </Link>
        ) : (
          <PremiumCard premium until={until} className="mt-auto" />
        ))}
      {!premium &&
        (compact ? (
          <Link
            to="/premium"
            aria-label={t('premium.title')}
            title={t('premium.title')}
            className="mt-auto flex size-14 items-center justify-center rounded-[16px] border-2 border-edge bg-sun text-on-accent shadow-shashka"
          >
            <Icon path={CROWN} size={26} stroke={2.6} />
          </Link>
        ) : (
          <PremiumCard premium={false} until={null} className="mt-auto" />
        ))}
    </nav>
  );
}

function BottomNav({ active }: { active: NavId | null }) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-5 border-t-2 border-line bg-surface"
    >
      {ITEMS.map((item) => {
        const on = item.id === active;
        return (
          <NavLink
            key={item.id}
            to={item.to}
            aria-current={on ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 text-[12px] font-extrabold no-underline ${on ? 'text-brand-text' : 'text-text-2'}`}
          >
            <span
              className={`flex h-8 w-[52px] items-center justify-center rounded-pill ${on ? 'bg-brand-tint' : ''}`}
            >
              <Icon path={item.icon} size={24} />
            </span>
            {t(`nav.${item.id}`)}
          </NavLink>
        );
      })}
    </nav>
  );
}

function TopBar({ title, layout }: { title: string; layout: NavLayout }) {
  const { t } = useTranslation();
  const signedIn = useAppSelector((state) => state.auth.status === 'authenticated');
  const progress = useProgressQuery(localDateKey(), { skip: !signedIn });
  const me = useMeQuery(undefined, { skip: !signedIn });
  const name = me.data?.displayName ?? me.data?.email ?? '';
  const initial = name.charAt(0).toUpperCase();
  return (
    <header className="flex min-h-[64px] items-center gap-3 tablet:min-h-[88px] border-b-2 border-line bg-bg px-4 tablet:pr-8 tablet:pl-7 desktop:pl-10">
      <h1 className="m-0 min-w-0 flex-1 font-heading text-[20px] leading-8 font-bold [overflow-wrap:anywhere] tablet:text-[24px]">
        {title}
      </h1>
      {progress.data && <DayBar progress={progress.data} compact={layout === 'bottom'} />}
      <Link
        to="/profile"
        aria-label={t('nav.profileOf', { name })}
        className="flex size-11 items-center justify-center rounded-full border-2 border-edge bg-brand font-heading text-[18px] font-extrabold text-on-brand no-underline"
      >
        {initial}
      </Link>
    </header>
  );
}

interface AppShellProps {
  /** The item of the navigation that is lit. */
  active?: NavId | null;
  title: string;
  children: ReactNode;
}

/**
 * The frame of every screen outside the focus mode (web/screens/layout.md): the sidebar on a wide screen,
 * icons on a tablet and a bar at the bottom on a phone, with the title and the day of the cat on top.
 */
export function AppShell({
  active = null,
  title,
  children,
}: AppShellProps & { active?: NavId | null }) {
  const layout = useNavLayout();
  const signedIn = useAppSelector((state) => state.auth.status === 'authenticated');
  // Read again when the tab gets focus: the payment may have happened in another tab or page
  const subscription = useSubscriptionQuery(undefined, { skip: !signedIn, refetchOnFocus: true });
  const premium = subscription.data?.premium === true;
  return (
    <div className="flex min-h-screen bg-bg text-text">
      {layout !== 'bottom' && (
        <SideNav
          active={active}
          layout={layout}
          premium={premium}
          until={subscription.data?.currentPeriodEnd ?? null}
        />
      )}
      <div className={`flex min-w-0 flex-1 flex-col ${layout === 'bottom' ? 'pb-[76px]' : ''}`}>
        <TopBar title={title} layout={layout} />
        <main className="flex flex-1 flex-col gap-4 px-4 py-4 pr-6 tablet:gap-6 tablet:py-8 tablet:px-7 desktop:px-10">
          <VerifyEmailReminder />
          {children}
        </main>
      </div>
      {layout === 'bottom' && <BottomNav active={active} />}
    </div>
  );
}
