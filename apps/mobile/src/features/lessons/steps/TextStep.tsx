import { createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space, typography } from '../../../theme/theme';
import { Board } from '../../board/Board';
import { StepFrame, useBoardSize } from '../StepFrame';
import { useStepActions, type StepContext } from '../stepProps';

type TextStepData = Extract<Step, { type: 'text' }>;

/** Theory: a short text, an optional list, an optional board, and the cat's closing remark. */
export function TextStep({ step, context }: { step: TextStepData; context: StepContext }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { advance } = useStepActions();
  const boardSize = useBoardSize();
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
          <View style={{ gap: space[2] }}>
            <Board
              state={boardState}
              dispatch={() => undefined}
              onSquarePress={() => undefined}
              arrows={step.board.arrows}
              size={boardSize}
            />
            {step.board.caption && (
              <Text style={[typography.small, { color: colors.text2 }]}>{step.board.caption}</Text>
            )}
          </View>
        ) : undefined
      }
    >
      <Text style={[typography.bodyL, { color: colors.text }]}>{step.body}</Text>
      {step.points.length > 0 && (
        <View
          style={{
            gap: space[2],
            padding: space[4],
            borderRadius: radius.card,
            borderWidth: 2,
            borderColor: colors.line,
            backgroundColor: colors.surface,
          }}
        >
          {step.pointsTitle && (
            <Text style={[typography.h3, { color: colors.text }]}>{step.pointsTitle}</Text>
          )}
          {step.points.map((point, index) => (
            <View key={point} style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandTint,
                }}
              >
                <Text style={[typography.small, { color: colors.brandText }]}>{index + 1}</Text>
              </View>
              <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{point}</Text>
            </View>
          ))}
        </View>
      )}
      <ReplyCard
        tone={step.remember ? 'info' : 'neutral'}
        title={step.remember ? t('lesson.remember') : step.title}
        actions={<Button large label={t('lesson.next')} onPress={advance} />}
      >
        {step.remember}
      </ReplyCard>
    </StepFrame>
  );
}
