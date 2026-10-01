import { createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { demoFrames } from '@kotgambit/lesson-player';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from '../../../shared/ui/icons';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { useReducedMotion } from '../../../shared/useReducedMotion';
import { Board } from '../../board';
import { StepFrame } from '../StepFrame';
import type { StepContext } from '../stepProps';
import { useStepActions } from '../useStepActions';

type DemoStepData = Extract<Step, { type: 'demo' }>;

const FRAME_MS = 1600;

/** The cat plays the moves, the learner watches. Reduced motion skips the film and shows the last position. */
export function DemoStep({ step, context }: { step: DemoStepData; context: StepContext }) {
  const { t } = useTranslation();
  const { advance } = useStepActions();
  const reducedMotion = useReducedMotion();
  const frames = useMemo(() => demoFrames(step), [step]);
  const last = frames.length - 1;
  const [index, setIndex] = useState(reducedMotion ? last : 0);
  const [playing, setPlaying] = useState(!reducedMotion);
  const message = useMemo(
    () => context.coach.message({ type: 'DEMO', detail: step.body }),
    [context.coach, step.body],
  );

  // The film loops: after the last position it waits a beat and starts again
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => setIndex((current) => (current >= last ? 0 : current + 1)),
      FRAME_MS,
    );
    return () => clearTimeout(timer);
  }, [playing, index, last]);

  const frame = frames[index] ?? frames[0];
  const state = useMemo(
    () => createBoardState({ fen: frame?.fen ?? step.fen, orientation: step.orientation }),
    [frame, step.fen, step.orientation],
  );

  return (
    <StepFrame
      caption={context.caption}
      title={step.title}
      mood="hint"
      board={
        <>
          <Board
            state={state}
            dispatch={() => undefined}
            onSquarePress={() => undefined}
            lastMove={frame?.from && frame.to ? { from: frame.from, to: frame.to } : null}
          />
          <div className="flex items-center gap-2">
            <IconButton
              quiet
              label={t('lesson.demo.back')}
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              quiet
              label={t(playing ? 'lesson.demo.pause' : 'lesson.demo.play')}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            <IconButton
              quiet
              label={t('lesson.demo.forward')}
              onClick={() => setIndex(Math.min(last, index + 1))}
              disabled={index === last}
            >
              <ChevronRightIcon />
            </IconButton>
            <span className="ml-2 text-[14px] font-bold text-text-2">
              {t('lesson.demo.stepOf', { n: index, total: last })}
            </span>
          </div>
        </>
      }
    >
      <span className="self-start rounded-pill bg-sky-tint px-3.5 py-1 text-[14px] font-bold text-sky-text">
        {t('lesson.demo.chip')}
      </span>
      <ReplyCard
        tone="hint"
        title={message.title}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIndex(0);
                setPlaying(!reducedMotion);
              }}
            >
              {t('lesson.demo.again')}
            </Button>
            <Button onClick={advance} data-autofocus>
              {t('lesson.demo.now')}
            </Button>
          </>
        }
      >
        {message.text} {t('lesson.demo.line')}
      </ReplyCard>
    </StepFrame>
  );
}
