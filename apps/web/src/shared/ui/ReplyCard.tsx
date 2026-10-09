import type { ReactNode } from 'react';
import { BulbIcon, CheckIcon, RetryIcon } from './icons';

export type ReplyTone = 'neutral' | 'success' | 'oops' | 'hint' | 'info';

const TONES: Record<ReplyTone, { card: string; title: string; badge: string }> = {
  neutral: { card: 'bg-surface', title: 'text-text', badge: '' },
  success: { card: 'bg-mint-tint', title: 'text-mint-text', badge: 'bg-mint text-on-accent' },
  oops: { card: 'bg-coral-tint', title: 'text-coral-text', badge: 'bg-coral text-on-accent' },
  hint: { card: 'bg-sky-tint', title: 'text-sky-text', badge: 'bg-sky text-on-accent' },
  info: { card: 'bg-sun-tint', title: 'text-sun-text', badge: 'bg-sun text-on-accent' },
};

const BADGE_ICONS: Partial<Record<ReplyTone, ReactNode>> = {
  success: <CheckIcon size={20} />,
  oops: <RetryIcon size={20} />,
  hint: <BulbIcon size={20} />,
};

interface ReplyCardProps {
  tone: ReplyTone;
  title: string;
  children?: ReactNode;
  /** The row of buttons under the text. */
  actions?: ReactNode;
  /** Which way the tail points, towards the cat. */
  tail?: 'down' | 'up';
  /** Small label next to the title, such as "1 из 3" for hints. */
  note?: string;
}

/**
 * The cat's reply: the answer to what the learner just did, with the way to go on. It replaces the bottom
 * "Check" bar, so everything about a result lives here (components.md, ReplyCard).
 */
export function ReplyCard({ tone, title, children, actions, tail = 'down', note }: ReplyCardProps) {
  const styles = TONES[tone];
  const badge = BADGE_ICONS[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`reply-card relative flex flex-col gap-3 rounded-reply border-3 border-edge p-5 shadow-shashka-lg ${styles.card}`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-10 size-5 rotate-45 border-edge bg-inherit ${tail === 'down' ? '-bottom-[13px] border-b-3 border-r-3' : '-top-[13px] border-l-3 border-t-3'}`}
      />
      <div className="flex items-center gap-3">
        {badge && (
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-edge ${styles.badge}`}
          >
            {badge}
          </span>
        )}
        <h2
          className={`m-0 font-heading text-[16px] leading-6 font-bold tablet:text-[18px] ${styles.title}`}
        >
          {title}
        </h2>
        {note && <span className="ml-auto text-[14px] font-bold text-sky-text">{note}</span>}
      </div>
      {children && (
        <p className="m-0 text-[14px] leading-5 font-semibold text-text tablet:text-[16px] tablet:leading-6">
          {children}
        </p>
      )}
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
