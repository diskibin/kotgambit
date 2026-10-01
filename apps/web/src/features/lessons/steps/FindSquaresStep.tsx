import { createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { hintFor, isCorrectSquares } from '@kotgambit/lesson-player';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { BulbIcon } from '../../../shared/ui/icons';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { Board } from '../../board';
import { StepFrame } from '../StepFrame';
import type { StepContext } from '../stepProps';
import { useStepActions } from '../useStepActions';

type FindSquaresData = Extract<Step, { type: 'find-squares' }>;

/** The learner taps squares to mark them, then checks the whole set at once. */
export function FindSquaresStep({
  step,
  context,
}: {
  step: FindSquaresData;
  context: StepContext;
}) {
  const { t } = useTranslation();
  const { check, retry, hint, advance } = useStepActions();
  const { session, coach } = context;
  const [marked, setMarked] = useState<string[]>([]);
  const boardState = useMemo(
    () => createBoardState({ fen: step.fen, orientation: step.orientation }),
    [step.fen, step.orientation],
  );
  const attempts = session.attempts[session.index] ?? 0;
  const { phase, hintLevel } = session;
  const activeHint = phase === 'working' && hintLevel > 0 ? hintFor(step, 1) : null;

  const message = useMemo(() => {
    if (phase === 'correct') {
      const streak = attempts === 1 ? session.firstTryStreak + 1 : 0;
      return coach.message({ type: 'STEP_CORRECT', detail: step.success, attempts, streak });
    }
    if (phase === 'wrong')
      return coach.message({ type: 'STEP_WRONG', detail: step.oops, attempts });
    return null;
  }, [phase, attempts, coach, step.success, step.oops, session.firstTryStreak]);

  const toggle = (square: string) =>
    setMarked((current) =>
      current.includes(square) ? current.filter((s) => s !== square) : [...current, square],
    );

  const hintButton = (
    <IconButton
      label={t('lesson.move.hint')}
      onClick={hint}
      disabled={phase !== 'working' || hintLevel >= 1}
    >
      <BulbIcon />
    </IconButton>
  );

  let card;
  if (phase === 'correct' && message) {
    card = (
      <ReplyCard
        tone="success"
        title={message.title}
        actions={
          <Button variant="success" large onClick={advance} data-autofocus>
            {t('lesson.move.next')}
          </Button>
        }
      >
        {message.text}
      </ReplyCard>
    );
  } else if (phase === 'wrong' && message) {
    card = (
      <ReplyCard
        tone="oops"
        title={message.title}
        actions={
          <Button
            onClick={() => {
              setMarked([]);
              retry();
            }}
            data-autofocus
          >
            {t('lesson.move.again')}
          </Button>
        }
      >
        {message.text}
      </ReplyCard>
    );
  } else if (activeHint) {
    card = (
      <ReplyCard
        tone="hint"
        title={t('lesson.move.hint')}
        actions={
          marked.length > 0 ? (
            <Button onClick={() => check(isCorrectSquares(step, marked))}>
              {t('lesson.move.check')}
            </Button>
          ) : undefined
        }
      >
        {activeHint.text}
      </ReplyCard>
    );
  } else {
    card = (
      <ReplyCard
        tone="neutral"
        title={t('lesson.move.yourMove')}
        actions={
          <>
            {hintButton}
            {marked.length > 0 ? (
              <Button onClick={() => check(isCorrectSquares(step, marked))} data-autofocus>
                {t('lesson.move.check')}
              </Button>
            ) : (
              <Button variant="text" disabled>
                {t('lesson.marks.needMark')}
              </Button>
            )}
          </>
        }
      >
        {step.prompt}
      </ReplyCard>
    );
  }

  const mood =
    phase === 'correct'
      ? (message?.mascot ?? 'happy')
      : phase === 'wrong'
        ? 'oops'
        : activeHint
          ? 'hint'
          : 'idle';

  return (
    <StepFrame
      caption={context.caption}
      title={step.title}
      mood={mood}
      board={
        <Board
          state={boardState}
          dispatch={() => undefined}
          marked={marked}
          disabled={phase !== 'working'}
          onSquarePress={toggle}
        />
      }
    >
      {card}
    </StepFrame>
  );
}
