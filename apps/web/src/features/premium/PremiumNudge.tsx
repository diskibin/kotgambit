import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '../../shared/ui/Button';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

interface PremiumNudgeProps {
  kind: 'puzzles' | 'analysis' | 'cards';
  /** A smaller card inside a page, instead of one that fills it. */
  compact?: boolean;
}

/**
 * What a free learner sees when a limit of the day is reached or a feature is Premium's: a sleepy cat, the
 * plain fact and the way to Premium. No red, no pressure (PLAN.md 14.2).
 */
export function PremiumNudge({ kind, compact = false }: PremiumNudgeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
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
      <Button variant="premium" onClick={() => void navigate('/premium')}>
        {t('limits.cta')}
      </Button>
    </section>
  );
}
