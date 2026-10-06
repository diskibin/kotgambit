import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '../../shared/ui/Button';
import { useTrack } from '../analytics/useTrack';

/** From this many left a free learner is told, kindly, that the day's limit is near. */
export const HINT_LEFT = 2;

interface PremiumHintProps {
  kind: 'puzzles' | 'analysis';
  left: number | null;
}

/**
 * A quiet line before the limit is reached, so that the limit is not a surprise. It shows only for a learner who
 * has a limit (Premium has none, the server sends `null`) and still has something left.
 */
export function PremiumHint({ kind, left }: PremiumHintProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const track = useTrack();
  const shown = left !== null && left > 0 && left <= HINT_LEFT;

  useEffect(() => {
    if (shown) track('nudge_view', { oncePerSession: true, detail: `${kind}-soft` });
  }, [shown, kind, track]);

  if (!shown) return null;
  return (
    <aside className="flex flex-wrap items-center gap-3 rounded-card border-2 border-dashed border-sun-depth bg-sun-tint px-4 py-3">
      <p className="m-0 min-w-[200px] flex-1 text-[15px] font-semibold">
        {t(`limits.soft.${kind}`, { left })}
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          track('nudge_click', { detail: `${kind}-soft` });
          void navigate('/premium');
        }}
      >
        {t('limits.cta')}
      </Button>
    </aside>
  );
}
