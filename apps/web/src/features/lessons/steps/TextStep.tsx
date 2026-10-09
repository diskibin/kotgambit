import type { Step } from '@kotgambit/content-schema';
import { createBoardState } from '@kotgambit/board-controller';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { Board } from '../../board';
import { StepFrame } from '../StepFrame';
import type { StepContext } from '../stepProps';
import { useStepActions } from '../useStepActions';

type TextStepData = Extract<Step, { type: 'text' }>;

/** Theory: a short text, an optional list, an optional board, and the cat's closing remark. */
export function TextStep({ step, context }: { step: TextStepData; context: StepContext }) {
  const { t } = useTranslation();
  const { advance } = useStepActions();
  const boardState = useMemo(
    () =>
      step.board
        ? createBoardState({ fen: step.board.fen, orientation: step.board.orientation })
        : null,
    [step.board],
  );

  return (
    <StepFrame
      caption={context.caption}
      title={step.title}
      mood={step.remember ? 'hint' : 'idle'}
      board={
        step.board && boardState ? (
          <Board
            state={boardState}
            dispatch={() => undefined}
            onSquarePress={() => undefined}
            arrows={step.board.arrows}
          />
        ) : undefined
      }
      underBoard={
        step.board?.caption && (
          <p className="m-0 text-[15px] font-bold text-text-2">{step.board.caption}</p>
        )
      }
    >
      <p className="m-0 text-[18px] leading-7 font-semibold">{step.body}</p>
      {step.points.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface p-4">
          {step.pointsTitle && (
            <h2 className="m-0 font-heading text-[15px] font-bold">{step.pointsTitle}</h2>
          )}
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {step.points.map((point, index) => (
              <li
                key={point}
                className="flex items-start gap-3 text-[16px] leading-6 font-semibold"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[14px] font-extrabold text-brand-text">
                  {index + 1}
                </span>
                {point}
              </li>
            ))}
          </ol>
        </div>
      )}
      <ReplyCard
        tone={step.remember ? 'info' : 'neutral'}
        title={step.remember ? t('lesson.remember') : step.title}
        actions={
          <Button large onClick={advance} data-autofocus>
            {t('lesson.next')}
          </Button>
        }
      >
        {step.remember}
      </ReplyCard>
    </StepFrame>
  );
}
