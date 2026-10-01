import { createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { hintFor, isCorrectSquares } from '@kotgambit/lesson-player';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { BulbIcon } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { useTheme } from '../../../theme/ThemeProvider';
import { Board } from '../../board/Board';
import { StepFrame, useBoardSize } from '../StepFrame';
import { useStepActions, type StepContext } from '../stepProps';

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
  const { colors } = useTheme();
  const { check, retry, hint, advance } = useStepActions();
  const { session, coach } = context;
  const boardSize = useBoardSize();
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

  const checkButton = (
    <Button label={t('lesson.move.check')} onPress={() => check(isCorrectSquares(step, marked))} />
  );

  const hintButton = (
    <IconButton
      label={t('lesson.move.hint')}
      onPress={hint}
      disabled={phase !== 'working' || hintLevel >= 1}
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
          <Button
            label={t('lesson.move.again')}
            onPress={() => {
              setMarked([]);
              retry();
            }}
          />
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
        actions={marked.length > 0 ? checkButton : undefined}
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
              checkButton
            ) : (
              <Button
                variant="text"
                label={t('lesson.marks.needMark')}
                onPress={() => undefined}
                disabled
              />
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
          size={boardSize}
        />
      }
    >
      {card}
    </StepFrame>
  );
}
