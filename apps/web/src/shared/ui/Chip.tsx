import type { ReactNode } from 'react';

type Tone = 'mint' | 'coral';

const TONES: Record<Tone, string> = {
  mint: 'bg-mint-tint text-mint-text',
  coral: 'bg-coral-tint text-coral-text',
};

/** A small status label: a pill with a tinted background, never an outline. */
export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 self-center rounded-pill px-3.5 text-[14px] font-bold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
