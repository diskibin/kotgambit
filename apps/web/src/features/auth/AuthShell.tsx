import type { Mood } from '@kotgambit/mascot';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

function Tiles({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute hidden grid-cols-5 grid-rows-5 tablet:grid ${className}`}
    >
      {Array.from({ length: 25 }, (_, index) => (
        <div key={index} className={`size-20 ${index % 2 === 0 ? 'bg-brand-tint' : ''}`} />
      ))}
    </div>
  );
}

interface AuthShellProps {
  mood: Mood;
  /** 112 on the sign-in card, 150 on the recovery cards. */
  catSize: number;
  /** Max width of the card in px: 480 for sign-in, 460 for recovery. */
  cardWidth: number;
  children: ReactNode;
}

/** The frame shared by sign-in, recovery and confirmation: the logo, the corner tiles and a card with the cat on top. */
export function AuthShell({ mood, catSize, cardWidth, children }: AuthShellProps) {
  const { t } = useTranslation();
  const scheme = useScheme();

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-bg text-text">
      <Tiles className="-bottom-10 -left-[60px] rotate-[8deg]" />
      <Tiles className="-right-[60px] -top-10 -rotate-[10deg]" />

      <header className="relative flex h-20 items-center self-stretch px-4 tablet:px-12">
        <Link to="/" className="flex items-center gap-2.5 font-heading text-[19px] font-bold">
          <Mascot mood="idle" size={44} dark={scheme === 'dark'} />
          {t('auth.logo')}
        </Link>
      </header>

      <main className="relative flex w-full flex-col items-center px-4 pr-6 pb-12">
        {/* The cat stands on the card, so the card moves up under its paws */}
        <div className="relative mb-[-30px]">
          <Mascot mood={mood} size={catSize} dark={scheme === 'dark'} animate />
        </div>
        <div
          style={{ maxWidth: cardWidth }}
          className="flex w-full flex-col gap-3 rounded-[28px] border-3 border-edge bg-surface p-6 shadow-shashka-lg tablet:px-8"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
