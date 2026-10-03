import type { ProgressSummary } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { pieceUrl } from '../board/pieceAssets';

const CELLS = 10;
const SECONDS_IN_MINUTE = 60;

/**
 * "День конём": ten board squares, one for every tenth of the daily goal, with the knight standing
 * on the last filled one. It replaces the flame, the XP counter and the ring (README, rules of the style).
 */
export function DayBar({
  progress,
  compact = false,
}: {
  progress: ProgressSummary;
  /** The phone size of the design: smaller squares and no words, the group still says everything to a screen reader. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { todaySeconds, goalSeconds, streakDays } = progress;
  const goalMinutes = Math.round(goalSeconds / SECONDS_IN_MINUTE);
  const doneMinutes = Math.floor(todaySeconds / SECONDS_IN_MINUTE);
  const filled = Math.min(CELLS, Math.floor((todaySeconds / goalSeconds) * CELLS));
  const reached = todaySeconds >= goalSeconds;

  const streak =
    streakDays === 0 ? t('dayBar.streakNone') : t('dayBar.streak', { count: streakDays });
  const minutes = reached
    ? t('dayBar.reached')
    : t('dayBar.minutes', { done: doneMinutes, goal: goalMinutes });

  return (
    <div
      role="group"
      aria-label={t('dayBar.label', { done: doneMinutes, goal: goalMinutes, streak })}
      className="flex items-center gap-3"
    >
      <div
        className={`flex-col text-right text-[13px] leading-4 font-bold ${compact ? 'hidden' : 'flex'}`}
      >
        <span className="text-text">{minutes}</span>
        <span className="text-flame-text">{streak}</span>
      </div>
      <div aria-hidden="true" className="flex overflow-hidden rounded-[9px] border-2 border-edge">
        {Array.from({ length: CELLS }, (_, index) => (
          <span
            key={index}
            className={`flex items-center justify-center ${compact ? 'h-[18px] w-4' : 'h-7 w-6'} ${
              index < filled ? (index % 2 === 0 ? 'bg-board-a' : 'bg-board-b') : 'bg-surface'
            }`}
          >
            {index === filled - 1 && (
              <img src={pieceUrl('w', 'n')} alt="" className={compact ? 'size-4' : 'size-6'} />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
