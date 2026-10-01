import { boardReducer, createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { hintFor, isCorrectMove, maxHintLevel } from '@kotgambit/lesson-player';
import { useMemo, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { BulbIcon } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { useTheme } from '../../../theme/ThemeProvider';
import { Board } from '../../board/Board';
import { StepFrame, useBoardSize } from '../StepFrame';
import { useStepActions, type StepContext } from '../stepProps';

type MoveStepData = Extract<Step, { type: 'move' }>;

/** The learner makes one move, presses "Check", and the cat answers in the reply card. */
export function MoveStep({ step, context }: { step: MoveStepData; context: StepContext }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { check, retry, hint, advance } = useStepActions();
  const { session, coach } = context;
  const boardSize = useBoardSize();
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
  const answer = hintFor(step, 3);

  const arrows =
    phase === 'correct'
      ? step.successArrows
      : showAnswer
        ? (answer?.arrows ?? [])
        : (activeHint?.arrows ?? []);
  const hintSquares = showAnswer ? (answer?.squares ?? []) : (activeHint?.squares ?? []);

  const hintButton = (
    <IconButton
      label={t('lesson.move.hint')}
      disabled={phase !== 'working' || hintLevel >= maxHints}
      onPress={() => {
        setHintHidden(false);
        hint();
      }}
    >
      <BulbIcon color={colors.text} />
    </IconButton>
  );

  let card;
  if (phase === 'correct' && message) {
    card = (
      <ReplyCard
        tone="success"
        title={message.title}
        actions={<Button variant="success" large label={t('lesson.move.next')} onPress={advance} />}
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
            <Button
              variant="secondary"
              label={t('lesson.move.show')}
              onPress={() => setShowAnswer(true)}
            />
            <Button
              label={t('lesson.move.again')}
              onPress={() => {
                reset();
                setShowAnswer(false);
                retry();
              }}
            />
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
              <Button variant="secondary" label={t('lesson.move.moreHint')} onPress={hint} />
            )}
            <Button label={t('lesson.move.understood')} onPress={() => setHintHidden(true)} />
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
            <Button variant="secondary" label={t('lesson.move.undo')} onPress={reset} />
            <Button
              label={t('lesson.move.check')}
              onPress={() =>
                check(board.lastMove ? isCorrectMove(step, board.lastMove.uci) : false)
              }
            />
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
            <Button
              variant="text"
              label={t('lesson.move.needMove')}
              onPress={() => undefined}
              disabled
            />
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
          state={board}
          dispatch={boardDispatch}
          disabled={phase !== 'working' || moved}
          arrows={arrows}
          hintSquares={hintSquares}
          size={boardSize}
        />
      }
    >
      {card}
    </StepFrame>
  );
}
