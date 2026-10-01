import type { ReactNode } from 'react';

/** A calm coral notice with an icon and the next step, never a red alarm. */
export function Banner({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-card border-2 border-coral-border bg-coral-tint px-3.5 py-3"
    >
      <svg
        className="mt-0.5 shrink-0 text-coral-text"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.3" />
      </svg>
      <span className="text-[15px] leading-[22px] font-bold text-coral-text">{children}</span>
    </div>
  );
}
