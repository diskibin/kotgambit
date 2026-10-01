import { boardReducer, createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { hintFor, isCorrectMove, maxHintLevel } from '@kotgambit/lesson-player';
import { useMemo, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { BulbIcon } from '../../../shared/ui/icons';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { Board } from '../../board';
import { StepFrame } from '../StepFrame';
import type { StepContext } from '../stepProps';
import { useStepActions } from '../useStepActions';

type MoveStepData = Extract<Step, { type: 'move' }>;

/** The learner makes one move, presses "Check", and the cat answers in the reply card. */
export function MoveStep({ step, context }: { step: MoveStepData; context: StepContext }) {
  const { t } = useTranslation();
  const { check, retry, hint, advance } = useStepActions();
  const { session, coach } = context;
  const [board, boardDispatch] = useReducer(boardReducer, undefined, () =>
    createBoardState({ fen: step.fen, orientation: step.orientation }),
  );
  // After a wrong answer the learner can ask to see the move
  const [showAnswer, setShowAnswer] = useState(false);
  // "Понятно" closes the hint card, the arrow stays on the board
  const [hintHidden, setHintHidden] = useState(false);

  const attempts = session.attempts[session.index] ?? 0;
  const { phase, hintLevel } = session;
  const moved = board.lastMove !== null;
  const hintLevelNow = hintLevel === 0 ? null : hintLevel;
  const activeHint = phase === 'working' && hintLevelNow ? hintFor(step, hintLevelNow) : null;
  const maxHints = maxHintLevel(step);

  const message = useMemo(() => {
    if (phase === 'correct') {
      const streak = attempts === 1 ? session.firstTryStreak + 1 : 0;
      return coach.message({ type: 'STEP_CORRECT', detail: step.success, attempts, streak });
    }
    if (phase === 'wrong')
      return coach.message({ type: 'STEP_WRONG', detail: step.oops, attempts });
    return null;
  }, [phase, attempts, coach, step.success, step.oops, session.firstTryStreak]);

  const reset = () => boardDispatch({ type: 'position/set', fen: step.fen });

  const arrows =
    phase === 'correct'
      ? step.successArrows
      : showAnswer
        ? (hintFor(step, 3)?.arrows ?? [])
        : (activeHint?.arrows ?? []);
  const hintSquares = showAnswer ? (hintFor(step, 3)?.squares ?? []) : (activeHint?.squares ?? []);

  const hintButton = (
    <IconButton
      label={t('lesson.move.hint')}
      onClick={() => {
        setHintHidden(false);
        hint();
      }}
      disabled={phase !== 'working' || hintLevel >= maxHints}
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
          <>
            <Button variant="secondary" onClick={() => setShowAnswer(true)}>
              {t('lesson.move.show')}
            </Button>
            <Button
              onClick={() => {
                reset();
                setShowAnswer(false);
                retry();
              }}
              data-autofocus
            >
              {t('lesson.move.again')}
            </Button>
          </>
        }
      >
        {message.text}
      </ReplyCard>
    );
  } else if (activeHint && hintLevelNow && !hintHidden) {
    card = (
      <ReplyCard
        tone="hint"
        title={t('lesson.move.hint')}
        note={t('lesson.move.hintOf', { n: hintLevelNow, total: maxHints })}
        actions={
          <>
            {hintLevelNow < maxHints && (
              <Button variant="secondary" onClick={hint}>
                {t('lesson.move.moreHint')}
              </Button>
            )}
            <Button onClick={() => setHintHidden(true)} data-autofocus>
              {t('lesson.move.understood')}
            </Button>
          </>
        }
      >
        {activeHint.text}
      </ReplyCard>
    );
  } else if (moved) {
    card = (
      <ReplyCard
        tone="neutral"
        title={t('lesson.move.ready')}
        actions={
          <>
            {hintButton}
            <Button variant="secondary" onClick={reset}>
              {t('lesson.move.undo')}
            </Button>
            <Button
              onClick={() =>
                check(board.lastMove ? isCorrectMove(step, board.lastMove.uci) : false)
              }
              data-autofocus
            >
              {t('lesson.move.check')}
            </Button>
          </>
        }
      >
        {t('lesson.move.readyText')}
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
            <Button variant="text" disabled>
              {t('lesson.move.needMove')}
            </Button>
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
      boardNote
      board={
        <Board
          state={board}
          dispatch={boardDispatch}
          disabled={phase !== 'working' || moved}
          arrows={arrows}
          hintSquares={hintSquares}
        />
      }
    >
      {card}
    </StepFrame>
  );
}
