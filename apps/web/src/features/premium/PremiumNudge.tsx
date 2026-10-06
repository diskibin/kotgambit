import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '../../shared/ui/Button';
import { useTrack } from '../analytics/useTrack';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

type Kind = 'puzzles' | 'analysis' | 'cards';

interface PremiumNudgeProps {
  kind: Kind;
  /** A smaller card inside a page, instead of one that fills it. */
  compact?: boolean;
}

// What Premium gives that matters to someone who has just run into this limit, the closest first
const BENEFITS: Record<Kind, readonly string[]> = {
  puzzles: ['unlimitedPuzzles', 'cards', 'fullReview'],
  analysis: ['unlimitedAnalysis', 'fullReview', 'cards'],
  cards: ['cards', 'fullReview', 'unlimitedPuzzles'],
};

/**
 * What a free learner sees when a limit of the day is reached or a feature is Premium's: a sleepy cat, the
 * plain fact, what Premium would change for them right here and the way to it. No red, no pressure (PLAN.md 14.2).
 */
export function PremiumNudge({ kind, compact = false }: PremiumNudgeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  const track = useTrack();

  useEffect(() => {
    track('nudge_view', { oncePerSession: true, detail: `${kind}-limit` });
  }, [kind, track]);

  return (
    <section
      className={`flex flex-col items-center gap-3 text-center ${compact ? 'rounded-card border-2 border-dashed border-sun-depth bg-sun-tint p-6' : 'p-6'}`}
    >
      <Mascot mood="sleepy" size={compact ? 110 : 150} dark={scheme === 'dark'} />
      <h2 className="m-0 max-w-[600px] font-heading text-[24px] leading-9 font-bold">
        {t(`limits.${kind}.title`)}
      </h2>
      <p className="m-0 max-w-[600px] text-[17px] font-semibold text-text-2">
        {t(`limits.${kind}.text`)}
      </p>
      <ul className="m-0 flex max-w-[600px] list-none flex-col gap-1 p-0 text-left text-[15px] font-semibold">
        {BENEFITS[kind].map((benefit) => (
          <li key={benefit} className="flex gap-2">
            <span aria-hidden="true" className="font-extrabold text-sun-text">
              +
            </span>
            {t(`limits.benefit.${benefit}`)}
          </li>
        ))}
      </ul>
      <Button
        variant="premium"
        onClick={() => {
          track('nudge_click', { detail: `${kind}-limit` });
          void navigate('/premium');
        }}
      >
        {t('limits.cta')}
      </Button>
    </section>
  );
}
