import { createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { demoFrames } from '@kotgambit/lesson-player';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from '../../../shared/ui/icons';
import { IconButton } from '../../../shared/ui/IconButton';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { useReducedMotion } from '../../../shared/useReducedMotion';
import { useTheme } from '../../../theme/ThemeProvider';
import { space, typography } from '../../../theme/theme';
import { Board } from '../../board/Board';
import { StepFrame, useBoardSize } from '../StepFrame';
import { useStepActions, type StepContext } from '../stepProps';

type DemoStepData = Extract<Step, { type: 'demo' }>;

const FRAME_MS = 1600;

/** The cat plays the moves, the learner watches. Reduced motion skips the film and shows the last position. */
export function DemoStep({ step, context }: { step: DemoStepData; context: StepContext }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { advance } = useStepActions();
  const reducedMotion = useReducedMotion();
  const boardSize = useBoardSize();
  const frames = useMemo(() => demoFrames(step), [step]);
  const last = frames.length - 1;
  // `null` means "wherever the film is by default": the start, or the end when motion is reduced
  const [chosen, setChosen] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const index = chosen ?? (reducedMotion ? last : 0);
  const playing = !paused && !reducedMotion;
  const setIndex = (next: number) => setChosen(next);
  const message = useMemo(
    () => context.coach.message({ type: 'DEMO', detail: step.body }),
    [context.coach, step.body],
  );

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setChosen(index >= last ? 0 : index + 1), FRAME_MS);
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
        <View style={{ gap: space[2] }}>
          <Board
            state={state}
            dispatch={() => undefined}
            onSquarePress={() => undefined}
            lastMove={frame?.from && frame.to ? { from: frame.from, to: frame.to } : null}
            size={boardSize}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              quiet
              label={t('lesson.demo.back')}
              disabled={index === 0}
              onPress={() => setIndex(Math.max(0, index - 1))}
            >
              <ChevronLeftIcon color={colors.text2} />
            </IconButton>
            <IconButton
              quiet
              label={t(playing ? 'lesson.demo.pause' : 'lesson.demo.play')}
              onPress={() => setPaused(playing)}
            >
              {playing ? <PauseIcon color={colors.text2} /> : <PlayIcon color={colors.text2} />}
            </IconButton>
            <IconButton
              quiet
              label={t('lesson.demo.forward')}
              disabled={index === last}
              onPress={() => setIndex(Math.min(last, index + 1))}
            >
              <ChevronRightIcon color={colors.text2} />
            </IconButton>
            <Text style={[typography.small, { color: colors.text2, marginLeft: space[2] }]}>
              {t('lesson.demo.stepOf', { n: index, total: last })}
            </Text>
          </View>
        </View>
      }
    >
      <ReplyCard
        tone="hint"
        title={message.title}
        actions={
          <>
            <Button
              variant="secondary"
              label={t('lesson.demo.again')}
              onPress={() => {
                setChosen(0);
                setPaused(false);
              }}
            />
            <Button label={t('lesson.demo.now')} onPress={advance} />
          </>
        }
      >
        {message.text} {t('lesson.demo.line')}
      </ReplyCard>
    </StepFrame>
  );
}
