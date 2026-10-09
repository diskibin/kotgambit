import { apiErrorOf, type CompleteLessonResponse } from '@kotgambit/contracts';
import { createCoach } from '@kotgambit/coach';
import { elapsedSeconds, reportedAttempts } from '@kotgambit/lesson-player';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useCompleteLessonMutation, useLessonQuery } from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { localDateKey } from '../../shared/localDate';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { IconButton } from '../../shared/ui/IconButton';
import { ChevronLeftIcon, CloseIcon } from '../../shared/ui/icons';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { DemoStep } from './steps/DemoStep';
import { FindSquaresStep } from './steps/FindSquaresStep';
import { MoveStep } from './steps/MoveStep';
import { QuizStep } from './steps/QuizStep';
import { TextStep } from './steps/TextStep';
import type { StepContext } from './stepProps';

export interface LessonResultState {
  result: CompleteLessonResponse;
  title: string;
}

/** The lesson in focus mode: a close button, a progress bar and one step at a time. */
export function LessonPage() {
  const { id = '' } = useParams();
  // A new id starts a new screen with fresh state
  return <LessonScreen key={id} id={id} />;
}

function LessonScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const scheme = useScheme();
  const { data: lesson, error, isLoading, refetch } = useLessonQuery(id);
  const session = useAppSelector((state) => state.lessonSession);
  const [complete, completion] = useCompleteLessonMutation();
  const coach = useMemo(() => createCoach(), []);
  const [exiting, setExiting] = useState(false);
  const started = useRef(false);

  // The session begins when the lesson arrives, and is dropped when the page is left
  useEffect(() => {
    if (lesson && session.lessonId !== lesson.id) {
      dispatch({
        type: 'lesson/started',
        lessonId: lesson.id,
        stepTypes: lesson.steps.map((step) => step.type),
        now: Date.now(),
      });
    }
  }, [lesson, session.lessonId, dispatch]);
  useEffect(() => () => void dispatch({ type: 'lesson/exited' }), [dispatch]);

  const finished =
    lesson !== undefined && session.lessonId === lesson.id && session.finishedAt !== null;

  async function submit() {
    if (!lesson) return;
    const result = await complete({
      id: lesson.id,
      attempts: reportedAttempts(session),
      seconds: elapsedSeconds(session),
      localDate: localDateKey(),
    });
    if ('error' in result) return;
    const state: LessonResultState = { result: result.data, title: lesson.title };
    void navigate(`/lesson/${lesson.id}/done`, { replace: true, state });
  }

  // Once, when the last step is done. A failed save stays on screen with a button to try again.
  useEffect(() => {
    if (finished && !started.current) {
      started.current = true;
      void submit();
    }
    // `submit` reads the finished session, running it once when the lesson finishes is the point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (isLoading || (lesson && session.lessonId !== lesson.id)) {
    return (
      <div
        role="status"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg"
      >
        <Mascot mood="thinking" size={140} dark={scheme === 'dark'} animate />
        <p className="m-0 font-heading text-[18px] font-bold">{t('lesson.loading')}</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
        <Mascot mood="oops" size={140} dark={scheme === 'dark'} />
        <p className="m-0 max-w-sm text-[16px] font-semibold">
          {apiErrorOf(error)?.message ?? t('lesson.loadError')}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => void navigate('/learn')}>
            {t('lesson.complete.home')}
          </Button>
          <Button onClick={() => void refetch()}>{t('lesson.retryLoad')}</Button>
        </div>
      </div>
    );
  }

  const step = lesson.steps[session.index];
  const context: StepContext = {
    lesson,
    session,
    coach,
    caption: t('lesson.caption', {
      track: t(`tracks.${lesson.track}`),
      order: lesson.order,
      step: session.index + 1,
      total: lesson.steps.length,
    }),
    nextType: lesson.steps[session.index + 1]?.type ?? null,
  };

  return (
    <div className="flex h-dvh flex-col bg-bg text-text tablet:h-auto tablet:min-h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 px-2 tablet:h-20 tablet:gap-4 tablet:px-8">
        <IconButton quiet label={t('lesson.close')} onClick={() => setExiting(true)}>
          <CloseIcon />
        </IconButton>
        {session.index > 0 && !finished && (
          <IconButton
            quiet
            label={t('lesson.back')}
            onClick={() => dispatch({ type: 'step/back' })}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
        <ProgressBar value={session.index} max={lesson.steps.length} label={t('lesson.progress')} />
      </header>

      {completion.isError && (
        <div className="mx-auto mb-4 flex w-full max-w-[620px] flex-col gap-3 px-4">
          <Banner>{t('lesson.saveError')}</Banner>
          <Button onClick={() => void submit()}>{t('lesson.retryLoad')}</Button>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto tablet:overflow-visible">
        {step && (
          <div key={session.index} className="flex flex-1 flex-col">
            {step.type === 'text' && <TextStep step={step} context={context} />}
            {step.type === 'demo' && <DemoStep step={step} context={context} />}
            {step.type === 'move' && <MoveStep step={step} context={context} />}
            {step.type === 'quiz' && <QuizStep step={step} context={context} />}
            {step.type === 'find-squares' && <FindSquaresStep step={step} context={context} />}
          </div>
        )}
      </main>

      {exiting && (
        <Dialog label={t('lesson.exit.title')} onClose={() => setExiting(false)}>
          <Mascot mood="oops" size={96} dark={scheme === 'dark'} />
          <h2 className="m-0 font-heading text-[22px] font-bold">{t('lesson.exit.title')}</h2>
          <p className="m-0 text-[16px] font-medium text-text-2">{t('lesson.exit.text')}</p>
          <Button large fullWidth onClick={() => setExiting(false)} data-autofocus>
            {t('lesson.exit.stay')}
          </Button>
          <Button variant="danger" onClick={() => void navigate('/learn')}>
            {t('lesson.exit.leave')}
          </Button>
        </Dialog>
      )}
    </div>
  );
}
