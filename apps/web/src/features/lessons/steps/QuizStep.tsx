import { createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { isCorrectOption, optionKey } from '@kotgambit/lesson-player';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { CheckIcon, RetryIcon } from '../../../shared/ui/icons';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { Board } from '../../board';
import { StepFrame } from '../StepFrame';
import type { StepContext } from '../stepProps';
import { useStepActions } from '../useStepActions';

type QuizStepData = Extract<Step, { type: 'quiz' }>;

/** A question with up to four answers. The explanation of the chosen answer comes back in the reply card. */
export function QuizStep({ step, context }: { step: QuizStepData; context: StepContext }) {
  const { t } = useTranslation();
  const { check, retry, advance } = useStepActions();
  const { session, coach } = context;
  const [selected, setSelected] = useState<number | null>(null);
  const { phase } = session;
  const attempts = session.attempts[session.index] ?? 0;
  const chosen = selected === null ? undefined : step.options[selected];
  const boardState = useMemo(
    () =>
      step.board
        ? createBoardState({ fen: step.board.fen, orientation: step.board.orientation })
        : null,
    [step.board],
  );

  const message = useMemo(() => {
    if (phase === 'correct') {
      const streak = attempts === 1 ? session.firstTryStreak + 1 : 0;
      return coach.message({ type: 'STEP_CORRECT', detail: chosen?.explanation, attempts, streak });
    }
    if (phase === 'wrong')
      return coach.message({ type: 'STEP_WRONG', detail: chosen?.explanation, attempts });
    return null;
  }, [phase, attempts, coach, chosen, session.firstTryStreak]);

  let card;
  if (phase === 'correct' && message) {
    card = (
      <ReplyCard
        tone="success"
        title={message.title}
        tail="down"
        actions={
          <Button variant="success" large onClick={advance} data-autofocus>
            {t('lesson.next')}
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
              setSelected(null);
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
  } else if (selected !== null) {
    card = (
      <ReplyCard
        tone="neutral"
        title={t('lesson.quiz.selected', { key: optionKey(selected) })}
        actions={
          <Button onClick={() => check(isCorrectOption(step, selected))} data-autofocus>
            {t('lesson.move.check')}
          </Button>
        }
      >
        {t('lesson.quiz.selectedText')}
      </ReplyCard>
    );
  } else {
    card = (
      <ReplyCard
        tone="neutral"
        title={t('lesson.quiz.choose')}
        actions={
          <Button variant="text" disabled>
            {t('lesson.quiz.chooseFirst')}
          </Button>
        }
      >
        {t(step.board ? 'lesson.quiz.chooseText' : 'lesson.quiz.chooseTextPlain')}
      </ReplyCard>
    );
  }

  const mood =
    phase === 'correct'
      ? (message?.mascot ?? 'happy')
      : phase === 'wrong'
        ? 'oops'
        : selected === null
          ? 'thinking'
          : 'idle';

  return (
    <StepFrame
      caption={context.caption}
      title={step.question}
      mood={mood}
      board={
        step.board && boardState ? (
          <>
            <Board
              state={boardState}
              dispatch={() => undefined}
              onSquarePress={() => undefined}
              arrows={step.board.arrows}
            />
            {step.board.caption && (
              <p className="m-0 text-[15px] font-bold text-text-2">{step.board.caption}</p>
            )}
          </>
        ) : undefined
      }
    >
      <div
        role="radiogroup"
        aria-label={step.question}
        className="grid grid-cols-1 gap-3 pr-1 tablet:grid-cols-2"
      >
        {step.options.map((option, index) => {
          const isSelected = selected === index;
          const verdict =
            isSelected && phase === 'correct'
              ? 'correct'
              : isSelected && phase === 'wrong'
                ? 'wrong'
                : null;
          const look =
            verdict === 'correct'
              ? 'border-edge bg-mint-tint shadow-shashka'
              : verdict === 'wrong'
                ? 'border-edge bg-coral-tint shadow-shashka'
                : isSelected
                  ? 'border-3 border-edge bg-brand-tint shadow-shashka'
                  : 'border-line bg-surface';
          return (
            <button
              key={option.text}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={t('lesson.quiz.option', { key: optionKey(index), text: option.text })}
              disabled={phase !== 'working'}
              onClick={() => setSelected(index)}
              className={`flex min-h-14 items-center gap-3 rounded-card border-2 px-3 py-2 text-left text-[16px] font-bold disabled:cursor-default ${look}`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-[14px] font-extrabold">
                {verdict === 'correct' ? (
                  <CheckIcon size={18} />
                ) : verdict === 'wrong' ? (
                  <RetryIcon size={18} />
                ) : (
                  optionKey(index)
                )}
              </span>
              {option.text}
            </button>
          );
        })}
      </div>
      {card}
    </StepFrame>
  );
}
