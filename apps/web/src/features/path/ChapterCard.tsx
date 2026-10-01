import type { LessonSummary } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { LockIcon, StarIcon } from '../../shared/ui/icons';
import { Mascot } from '../mascot/Mascot';
import { MiniBoard } from './MiniBoard';

const STARS = 3;

function Stars({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <span role="img" aria-label={t('path.stars', { count })} className="flex gap-0.5">
      {Array.from({ length: STARS }, (_, index) => (
        <StarIcon
          key={index}
          size={16}
          className={index < count ? 'text-sun-depth' : 'text-line-strong'}
        />
      ))}
    </span>
  );
}

interface ChapterCardProps {
  lesson: LessonSummary;
  /** The chapter to do now: it gets the big card with a button. */
  current: boolean;
  onOpen: (id: string) => void;
  dark: boolean;
}

/** A chapter in the ribbon. Its look tells where the learner is: done, now, closed or premium. */
export function ChapterCard({ lesson, current, onOpen, dark }: ChapterCardProps) {
  const { t } = useTranslation();
  const label = t('path.chapter', { n: lesson.order });

  if (lesson.status === 'premium') {
    return (
      <article className="flex w-[200px] shrink-0 flex-col gap-2 rounded-chapter border-2 border-dashed border-sun-depth bg-sun-tint p-4">
        <div className="flex items-center justify-between text-sun-text">
          <LockIcon />
          <span className="rounded-pill border-2 border-edge bg-sun px-2.5 py-0.5 text-[12px] font-extrabold text-on-accent">
            {t('path.premium')}
          </span>
        </div>
        <p className="m-0 text-[13px] font-bold text-sun-text">{label}</p>
        <h3 className="m-0 font-heading text-[15px] leading-5 font-bold">{lesson.title}</h3>
        <p className="m-0 text-[13px] font-semibold text-sun-text">{t('path.premiumText')}</p>
      </article>
    );
  }

  if (lesson.status === 'locked') {
    return (
      <article className="flex w-[200px] shrink-0 flex-col gap-2 rounded-chapter border-2 border-dashed border-dashed bg-surface p-4 text-text-2">
        <LockIcon />
        <p className="m-0 text-[13px] font-bold">{label}</p>
        <h3 className="m-0 font-heading text-[15px] leading-5 font-bold">{lesson.title}</h3>
        <p className="m-0 text-[13px] font-semibold">{t('path.locked')}</p>
      </article>
    );
  }

  if (current) {
    return (
      <article className="relative flex w-[260px] shrink-0 flex-col gap-3 rounded-chapter border-3 border-edge bg-brand-tint p-4 shadow-shashka-lg">
        <div className="absolute -top-14 right-2" aria-hidden="true">
          <Mascot mood="wave" size={72} dark={dark} animate />
        </div>
        <p className="m-0 text-[13px] font-extrabold text-brand-text">
          {t(lesson.order === 1 ? 'path.chapterFirst' : 'path.chapterNow', { n: lesson.order })}
        </p>
        <MiniBoard piece={lesson.piece} size={226} moves />
        <h3 className="m-0 font-heading text-[18px] leading-6 font-bold">{lesson.title}</h3>
        <p className="m-0 text-[14px] font-semibold text-text-2">
          {t('path.meta', { steps: lesson.stepCount, minutes: lesson.minutes })}
        </p>
        <Button fullWidth onClick={() => onOpen(lesson.id)} data-autofocus>
          {t(lesson.order === 1 ? 'path.start' : 'path.continue')}
        </Button>
      </article>
    );
  }

  return (
    <article className="flex w-[200px] shrink-0 flex-col gap-2 rounded-chapter border-2 border-edge bg-surface p-4">
      <p className="m-0 text-[13px] font-bold text-text-2">{label}</p>
      <MiniBoard piece={lesson.piece} size={120} />
      <h3 className="m-0 font-heading text-[15px] leading-5 font-bold">{lesson.title}</h3>
      <div className="flex items-center justify-between">
        <Stars count={lesson.stars} />
        <button
          type="button"
          onClick={() => onOpen(lesson.id)}
          className="min-h-11 rounded-control px-2 text-[14px] font-extrabold text-brand-text"
        >
          {t('path.repeat')}
          <span className="sr-only"> {lesson.title}</span>
        </button>
      </div>
    </article>
  );
}
