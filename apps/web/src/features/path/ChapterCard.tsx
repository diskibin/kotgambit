import type { LessonSummary } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { MiniBoard } from './MiniBoard';

const STARS = 3;
const STAR_SIZE = 22;
const DONE_BOARD = 172;
const CURRENT_BOARD = 232;

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width={STAR_SIZE}
      height={STAR_SIZE}
      viewBox="0 0 24 24"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`stroke-edge ${filled ? 'fill-sun' : 'fill-line'}`}
    >
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
    </svg>
  );
}

function Stars({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <span role="img" aria-label={t('path.stars', { count })} className="flex gap-0.5">
      {Array.from({ length: STARS }, (_, index) => (
        <Star key={index} filled={index < count} />
      ))}
    </span>
  );
}

/** The closed chapter's cover: a lock on a plate the size of the board of the other cards. */
function LockPlate({ premium }: { premium: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{ width: DONE_BOARD, height: DONE_BOARD }}
      className={`flex items-center justify-center rounded-[12px] ${premium ? 'bg-sun-tint text-sun-text' : 'bg-surface-2 text-text-muted'}`}
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="10.5" width="14" height="10" rx="3" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </svg>
    </div>
  );
}

interface ChapterCardProps {
  lesson: LessonSummary;
  /** The chapter to do now: it gets the big card with a button. */
  current: boolean;
  onOpen: (id: string) => void;
}

const FRAME = 'flex shrink-0 flex-col gap-2 rounded-chapter p-3';

/** A chapter in the ribbon. Its look tells where the learner is: done, now, closed or premium. */
export function ChapterCard({ lesson, current, onOpen }: ChapterCardProps) {
  const { t } = useTranslation();
  const label = t('path.chapter', { n: lesson.order });
  const title = (size: string) => (
    <h3 className={`m-0 font-heading font-bold ${size}`}>{lesson.title}</h3>
  );

  if (lesson.status === 'premium') {
    return (
      <article
        aria-label={`${label}: ${lesson.title}`}
        className={`${FRAME} w-[200px] border-2 border-dashed border-sun-depth bg-sun-tint`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-extrabold text-text-2">{label}</span>
          <span className="flex h-[22px] items-center rounded-pill border-2 border-edge bg-sun px-2 text-[11px] font-extrabold text-on-accent">
            {t('path.premium')}
          </span>
        </div>
        <LockPlate premium />
        {title('text-[15px] leading-5')}
        <span className="text-[13px] font-semibold text-text-2">{t('path.premiumText')}</span>
      </article>
    );
  }

  if (lesson.status === 'locked') {
    return (
      <article
        aria-label={`${label}: ${lesson.title}`}
        className={`${FRAME} w-[200px] border-2 border-dashed border-[color:var(--color-dashed)] bg-surface`}
      >
        <span className="text-[12px] font-extrabold text-text-2">{label}</span>
        <LockPlate premium={false} />
        {title('text-[15px] leading-5')}
        <span className="text-[13px] font-semibold text-text-2">{t('path.locked')}</span>
      </article>
    );
  }

  if (current) {
    return (
      <article
        data-current
        aria-label={`${label}: ${lesson.title}`}
        className={`${FRAME} w-[260px] border-3 border-edge bg-brand-tint shadow-shashka-lg`}
      >
        <span className="text-[12px] font-extrabold text-brand-text">
          {t(lesson.order === 1 ? 'path.chapterFirst' : 'path.chapterNow', { n: lesson.order })}
        </span>
        <MiniBoard piece={lesson.piece} size={CURRENT_BOARD} moves />
        {title('text-[18px] leading-6')}
        <span className="text-[13px] font-semibold text-text-2">
          {t('path.meta', { steps: lesson.stepCount, minutes: lesson.minutes })}
        </span>
        <Button fullWidth onClick={() => onOpen(lesson.id)} data-autofocus>
          {t(lesson.order === 1 ? 'path.start' : 'path.continue')}
        </Button>
      </article>
    );
  }

  return (
    <article
      aria-label={`${label}: ${lesson.title}`}
      className={`${FRAME} w-[200px] border-2 border-edge bg-surface`}
    >
      <span className="text-[12px] font-extrabold text-text-2">{label}</span>
      <MiniBoard piece={lesson.piece} size={DONE_BOARD} />
      {title('text-[15px] leading-5')}
      <div className="flex items-center justify-between">
        <Stars count={lesson.stars} />
        <button
          type="button"
          onClick={() => onOpen(lesson.id)}
          className="relative min-h-11 rounded-control px-2 text-[14px] font-extrabold text-brand-text"
        >
          {t('path.repeat')}
          <span className="sr-only"> {lesson.title}</span>
        </button>
      </div>
    </article>
  );
}
