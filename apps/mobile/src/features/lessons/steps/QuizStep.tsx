import { createBoardState } from '@kotgambit/board-controller';
import type { Step } from '@kotgambit/content-schema';
import { isCorrectOption, optionKey } from '@kotgambit/lesson-player';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { CheckIcon, RetryIcon } from '../../../shared/ui/icons';
import { ReplyCard } from '../../../shared/ui/ReplyCard';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, shashka, size, space, typography } from '../../../theme/theme';
import { Board } from '../../board/Board';
import { StepFrame, useBoardSize } from '../StepFrame';
import { useStepActions, type StepContext } from '../stepProps';

type QuizStepData = Extract<Step, { type: 'quiz' }>;

/** A question with up to four answers. The explanation of the chosen answer comes back in the reply card. */
export function QuizStep({ step, context }: { step: QuizStepData; context: StepContext }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { check, retry, advance } = useStepActions();
  const { session, coach } = context;
  const boardSize = useBoardSize();
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
    if (phase === 'wrong') {
      return coach.message({ type: 'STEP_WRONG', detail: chosen?.explanation, attempts });
    }
    return null;
  }, [phase, attempts, coach, chosen, session.firstTryStreak]);

  let card;
  if (phase === 'correct' && message) {
    card = (
      <ReplyCard
        tone="success"
        title={message.title}
        actions={<Button variant="success" large label={t('lesson.next')} onPress={advance} />}
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
              setSelected(null);
              retry();
            }}
          />
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
          <Button
            label={t('lesson.move.check')}
            onPress={() => check(isCorrectOption(step, selected))}
          />
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
          <Button
            variant="text"
            label={t('lesson.quiz.chooseFirst')}
            onPress={() => undefined}
            disabled
          />
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
      <View accessibilityRole="radiogroup" style={{ gap: space[3] }}>
        {step.options.map((option, index) => {
          const isSelected = selected === index;
          const verdict =
            isSelected && phase === 'correct'
              ? 'correct'
              : isSelected && phase === 'wrong'
                ? 'wrong'
                : null;
          const background =
            verdict === 'correct'
              ? colors.mintTint
              : verdict === 'wrong'
                ? colors.coralTint
                : isSelected
                  ? colors.brandTint
                  : colors.surface;
          const loud = isSelected || verdict !== null;
          return (
            <View
              key={option.text}
              style={{ paddingRight: shashka.offset, paddingBottom: shashka.offset }}
            >
              {loud && (
                <View
                  style={{
                    position: 'absolute',
                    left: shashka.offset,
                    top: shashka.offset,
                    right: 0,
                    bottom: 0,
                    borderRadius: radius.card,
                    backgroundColor: colors.edge,
                  }}
                />
              )}
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={t('lesson.quiz.option', {
                  key: optionKey(index),
                  text: option.text,
                })}
                accessibilityState={{ selected: isSelected, disabled: phase !== 'working' }}
                disabled={phase !== 'working'}
                onPress={() => setSelected(index)}
                style={{
                  minHeight: size.buttonHeightL,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  paddingHorizontal: space[3],
                  borderRadius: radius.card,
                  borderWidth: isSelected ? shashka.borderLarge : shashka.border,
                  borderColor: loud ? colors.edge : colors.line,
                  backgroundColor: background,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface2,
                  }}
                >
                  {verdict === 'correct' ? (
                    <CheckIcon size={18} color={colors.mintText} />
                  ) : verdict === 'wrong' ? (
                    <RetryIcon size={18} color={colors.coralText} />
                  ) : (
                    <Text
                      style={[
                        typography.small,
                        { color: colors.text, fontFamily: 'Onest-ExtraBold' },
                      ]}
                    >
                      {optionKey(index)}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    typography.body,
                    { color: colors.text, flex: 1, fontFamily: 'Onest-Bold' },
                  ]}
                >
                  {option.text}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      {card}
    </StepFrame>
  );
}
