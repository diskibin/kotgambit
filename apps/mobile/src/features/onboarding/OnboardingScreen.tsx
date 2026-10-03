import { createBoardState } from '@kotgambit/board-controller';
import type { Mood } from '@kotgambit/mascot';
import type { PieceType } from '@kotgambit/chess-core';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch } from '../../app/hooks';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { ChevronLeftIcon } from '../../shared/ui/icons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, size, space, typography } from '../../theme/theme';
import { Board } from '../board/Board';
import { Piece } from '../board/Piece';
import { DayBar } from '../path/DayBar';
import { Mascot } from '../mascot/Mascot';
import { answered, FIRST_LESSON, GOALS, LEVELS, type Goal, type Level } from './onboarding.slice';

const STEPS = 4;
const SEGMENT_HEIGHT = 10;
const BOARD = 120;
const LEVEL_PIECE: Record<Level, PieceType> = { novice: 'p', basics: 'n', player: 'q' };
const GOAL_KEY: Record<Goal, 'easy' | 'normal' | 'serious'> = {
  5: 'easy',
  10: 'normal',
  15: 'serious',
};
const SECONDS_IN_MINUTE = 60;
const PREVIEW_SHARE = 0.6;
const NOOP = () => undefined;

function CatSays({ mood, size: cat, text }: { mood: Mood; size: number; text: string }) {
  const { colors, scheme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Mascot mood={mood} size={cat} dark={scheme === 'dark'} />
      <View
        style={{
          flex: 1,
          padding: space[3],
          borderRadius: radius.reply,
          borderWidth: shashka.border,
          borderColor: colors.line,
          backgroundColor: colors.surface,
        }}
      >
        <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

function Choice({
  label,
  selected,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View>
      {selected && (
        <View
          style={{
            position: 'absolute',
            left: shashka.offset,
            top: shashka.offset,
            right: -shashka.offset,
            bottom: -shashka.offset,
            borderRadius: radius.chapter,
            backgroundColor: colors.edge,
          }}
        />
      )}
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={{
          minHeight: 72,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          padding: space[3],
          borderRadius: radius.chapter,
          borderWidth: selected ? shashka.borderLarge : shashka.border,
          borderColor: selected ? colors.edge : colors.line,
          backgroundColor: selected ? colors.brandTint : colors.surface,
        }}
      >
        {children}
      </Pressable>
    </View>
  );
}

function ChoiceText({ title, text }: { title: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.button, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.small, { color: colors.text2 }]}>{text}</Text>
    </View>
  );
}

/** Four short steps before the first lesson: who the learner is, how much time they have, and where to start. */
export function OnboardingScreen({
  onAccount,
  onSignIn,
}: {
  /** The learner goes on to create an account. */
  onAccount: () => void;
  onSignIn: () => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState<Level>('basics');
  const [goal, setGoal] = useState<Goal>(10);
  const lesson = FIRST_LESSON[level];
  const board = useMemo(
    () =>
      createBoardState({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        orientation: 'w',
      }),
    [],
  );

  function finish(openLesson: boolean) {
    dispatch(answered({ goal, lesson: openLesson ? lesson.id : null }));
    onAccount();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          minHeight: 56,
          paddingTop: insets.top,
          paddingHorizontal: screenPadding,
        }}
      >
        {step > 1 ? (
          <IconButton quiet label={t('start.back')} onPress={() => setStep(step - 1)}>
            <ChevronLeftIcon color={colors.text} />
          </IconButton>
        ) : (
          <View style={{ width: size.tapMin }} />
        )}
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('start.progress', { current: step, total: STEPS })}
          accessibilityValue={{ min: 1, max: STEPS, now: step }}
          style={{ flex: 1, flexDirection: 'row', gap: space[1] }}
        >
          {Array.from({ length: STEPS }, (_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: SEGMENT_HEIGHT,
                borderRadius: SEGMENT_HEIGHT,
                borderWidth: shashka.border,
                borderColor: colors.edge,
                backgroundColor: index < step ? colors.brand : colors.surface,
              }}
            />
          ))}
        </View>
        <View style={{ width: size.tapMin }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: screenPadding,
          gap: space[4],
        }}
      >
        {step === 1 && (
          <View style={{ alignItems: 'center', gap: space[3] }}>
            <Mascot mood="wave" size={200} dark={scheme === 'dark'} animate />
            <Text
              accessibilityRole="header"
              style={[typography.display, { color: colors.text, textAlign: 'center' }]}
            >
              {t('start.hello.title')}
            </Text>
            <Text style={[typography.bodyL, { color: colors.text2, textAlign: 'center' }]}>
              {t('start.hello.text')}
            </Text>
          </View>
        )}

        {step === 2 && (
          <>
            <CatSays mood="thinking" size={88} text={t('start.level.question')} />
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('start.level.group')}
              style={{ gap: space[3] }}
            >
              {LEVELS.map((item) => (
                <Choice
                  key={item}
                  label={`${t(`start.level.${item}.title`)}. ${t(`start.level.${item}.text`)}`}
                  selected={level === item}
                  onSelect={() => setLevel(item)}
                >
                  <Piece color="w" type={LEVEL_PIECE[item]} size={44} />
                  <ChoiceText
                    title={t(`start.level.${item}.title`)}
                    text={t(`start.level.${item}.text`)}
                  />
                </Choice>
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <CatSays mood="idle" size={88} text={t('start.goal.question')} />
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('start.goal.group')}
              style={{ gap: space[3] }}
            >
              {GOALS.map((item) => {
                const key = GOAL_KEY[item];
                return (
                  <Choice
                    key={item}
                    label={`${t(`start.goal.${key}.title`)}. ${t(`start.goal.${key}.text`)}`}
                    selected={goal === item}
                    onSelect={() => setGoal(item)}
                  >
                    <ChoiceText
                      title={t(`start.goal.${key}.title`)}
                      text={t(`start.goal.${key}.text`)}
                    />
                  </Choice>
                );
              })}
            </View>
            <View
              style={{
                gap: space[2],
                padding: space[3],
                borderRadius: radius.card,
                borderWidth: shashka.border,
                borderColor: colors.line,
                backgroundColor: colors.surface,
              }}
            >
              <DayBar
                progress={{
                  streakDays: 0,
                  xpTotal: 0,
                  goalSeconds: goal * SECONDS_IN_MINUTE,
                  todaySeconds: Math.round(goal * SECONDS_IN_MINUTE * PREVIEW_SHARE),
                }}
              />
              <Text style={[typography.small, { color: colors.text2 }]}>
                {t('start.goal.preview')}
              </Text>
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <CatSays mood="happy" size={88} text={t('start.first.title')} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                padding: space[3],
                borderRadius: radius.chapter,
                borderWidth: shashka.borderLarge,
                borderColor: colors.edge,
                backgroundColor: colors.surface,
              }}
            >
              <View
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
                style={{ width: BOARD }}
              >
                <Board state={board} dispatch={NOOP} size={BOARD} coords={false} disabled />
              </View>
              <View style={{ flex: 1, gap: space[1] }}>
                <Text style={[typography.caption, { color: colors.brandText }]}>
                  {t(`onboarding.first.lessons.${level}.track`)}
                </Text>
                <Text style={[typography.h3, { color: colors.text }]}>
                  {t(`onboarding.first.lessons.${level}.title`)}
                </Text>
                <Text style={[typography.small, { color: colors.text2 }]}>
                  {t('start.first.steps', { steps: lesson.steps, minutes: lesson.minutes })}
                </Text>
              </View>
            </View>
            <Text style={[typography.small, { color: colors.text2 }]}>
              {t('start.first.reminder')}
            </Text>
          </>
        )}
      </ScrollView>

      <View
        style={{
          gap: space[1],
          padding: screenPadding,
          paddingBottom: insets.bottom + screenPadding,
        }}
      >
        {step < STEPS ? (
          <Button large label={t('start.next')} onPress={() => setStep(step + 1)} />
        ) : (
          <Button
            large
            variant="success"
            label={t('start.first.start')}
            onPress={() => finish(true)}
          />
        )}
        {step === 1 && (
          <Button variant="text" label={t('start.hello.haveAccount')} onPress={onSignIn} />
        )}
        {step === STEPS && (
          <Button variant="text" label={t('start.first.account')} onPress={() => finish(false)} />
        )}
      </View>
    </View>
  );
}
