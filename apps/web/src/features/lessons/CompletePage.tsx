import { createCoach } from '@kotgambit/coach';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { Button } from '../../shared/ui/Button';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { Confetti } from './Confetti';
import type { LessonResultState } from './LessonPage';

const PERCENT = 100;

/** After a lesson: the cat, what the learner earned and where to go next. */
export function CompletePage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  const state = useLocation().state as LessonResultState | null;
  const result = state?.result;
  const message = useMemo(
    () =>
      result
        ? createCoach().message({ type: 'LESSON_COMPLETED', accuracy: result.accuracy })
        : null,
    [result],
  );

  // The result lives in the navigation state, so a reload has nothing to show
  if (!result || !message) return <Navigate to="/learn" replace />;

  const tiles = [
    { label: t('lesson.complete.xp'), value: t('lesson.complete.xpValue', { xp: result.xp }) },
    {
      label: t('lesson.complete.accuracy'),
      value: t('lesson.complete.accuracyValue', { percent: Math.round(result.accuracy * PERCENT) }),
    },
    {
      label: t('lesson.complete.streak'),
      value: t('lesson.complete.day', { count: result.progress.streakDays }),
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-bg text-text">
      {message.effect === 'confetti' && <Confetti />}
      <main className="relative flex flex-1 flex-col items-center justify-center gap-5 px-4 py-10 text-center">
        <Mascot mood={message.mascot} size={220} dark={scheme === 'dark'} animate />
        <h1 className="m-0 max-w-[640px] font-heading text-[28px] leading-9 font-bold tablet:text-[40px] tablet:leading-[50px]">
          {message.title}
        </h1>
        <p className="m-0 max-w-[480px] text-[18px] leading-7 font-semibold text-text-2">
          {t('lesson.complete.subtitleDone')}
        </p>
        <dl className="m-0 grid w-full max-w-[560px] grid-cols-1 gap-3 pr-1 tablet:grid-cols-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex flex-col gap-1 rounded-card border-2 border-line bg-surface p-3"
            >
              <dt className="text-[13px] font-extrabold tracking-[0.05em] text-text-2 uppercase">
                {tile.label}
              </dt>
              <dd className="m-0 font-heading text-[22px] font-bold">{tile.value}</dd>
            </div>
          ))}
        </dl>
      </main>
      <footer className="flex w-full flex-wrap items-center justify-center gap-3 border-t-2 border-line bg-surface px-4 py-4 pr-6">
        <Button
          variant="secondary"
          large
          onClick={() => void navigate(`/lesson/${id}`, { replace: true })}
        >
          {t('lesson.complete.again')}
        </Button>
        <Button
          variant="success"
          large
          onClick={() =>
            void navigate(result.nextLessonId ? `/lesson/${result.nextLessonId}` : '/', {
              replace: true,
            })
          }
          data-autofocus
        >
          {t(result.nextLessonId ? 'lesson.complete.next' : 'lesson.complete.home')}
        </Button>
      </footer>
    </div>
  );
}
