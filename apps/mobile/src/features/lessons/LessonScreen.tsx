import { createCoach } from '@kotgambit/coach';
import { apiErrorOf, type CompleteLessonResponse } from '@kotgambit/contracts';
import { elapsedSeconds, reportedAttempts } from '@kotgambit/lesson-player';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCompleteLessonMutation, useLessonQuery } from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { localDateKey } from '../../shared/localDate';
import { Banner } from '../../shared/ui/Banner';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { CloseIcon } from '../../shared/ui/icons';
import { IconButton } from '../../shared/ui/IconButton';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { useTheme } from '../../theme/ThemeProvider';
import { screenPadding, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { DemoStep } from './steps/DemoStep';
import { FindSquaresStep } from './steps/FindSquaresStep';
import { MoveStep } from './steps/MoveStep';
import { QuizStep } from './steps/QuizStep';
import { TextStep } from './steps/TextStep';
import type { StepContext } from './stepProps';

export interface LessonResult {
  result: CompleteLessonResponse;
  lessonId: string;
  title: string;
}

interface LessonScreenProps {
  id: string;
  onExit: () => void;
  onFinished: (result: LessonResult) => void;
}

/** The lesson in focus mode: a close button, a progress bar and one step at a time. */
export function LessonScreen({ id, onExit, onFinished }: LessonScreenProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { data: lesson, error, isLoading, refetch } = useLessonQuery(id);
  const session = useAppSelector((state) => state.lessonSession);
  const [complete, completion] = useCompleteLessonMutation();
  const coach = useMemo(() => createCoach(), []);
  const [exiting, setExiting] = useState(false);
  const started = useRef(false);

  // The system Back button asks before leaving, like the cross does
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setExiting(true);
      return true;
    });
    return () => subscription.remove();
  }, []);

  // The session begins when the lesson arrives, and is dropped when the screen is left
  useEffect(() => {
    if (lesson && session.lessonId !== lesson.id) {
      dispatch({
        type: 'lesson/started',
        lessonId: lesson.id,
        stepTypes: lesson.steps.map((step) => step.type),
        now: Date.now(),
      });
    }
  }, [lesson, session.lessonId, dispatch]);
  useEffect(() => () => void dispatch({ type: 'lesson/exited' }), [dispatch]);

  const finished =
    lesson !== undefined && session.lessonId === lesson.id && session.finishedAt !== null;

  async function submit() {
    if (!lesson) return;
    const result = await complete({
      id: lesson.id,
      attempts: reportedAttempts(session),
      seconds: elapsedSeconds(session),
      localDate: localDateKey(),
    });
    if ('error' in result) return;
    onFinished({ result: result.data, lessonId: lesson.id, title: lesson.title });
  }

  // Once, when the last step is done. A failed save stays on screen with a button to try again.
  useEffect(() => {
    if (finished && !started.current) {
      started.current = true;
      void submit();
    }
    // `submit` reads the finished session, running it once when the lesson finishes is the point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (isLoading || (lesson && session.lessonId !== lesson.id)) {
    return (
      <View
        accessibilityRole="progressbar"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[3],
          backgroundColor: colors.bg,
        }}
      >
        <Mascot mood="thinking" size={120} dark={scheme === 'dark'} animate />
        <Text style={[typography.h3, { color: colors.text }]}>{t('lesson.loading')}</Text>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[3],
          padding: screenPadding,
          backgroundColor: colors.bg,
        }}
      >
        <Mascot mood="oops" size={120} dark={scheme === 'dark'} />
        <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>
          {apiErrorOf(error)?.message ?? t('lesson.loadError')}
        </Text>
        <Button variant="secondary" label={t('lesson.complete.home')} onPress={onExit} />
        <Button label={t('lesson.retryLoad')} onPress={() => void refetch()} />
      </View>
    );
  }

  const step = lesson.steps[session.index];
  const context: StepContext = {
    lesson,
    session,
    coach,
    caption: t('lesson.caption', {
      track: t(`tracks.${lesson.track}`),
      order: lesson.order,
      step: session.index + 1,
      total: lesson.steps.length,
    }),
    nextType: lesson.steps[session.index + 1]?.type ?? null,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          paddingTop: insets.top,
          paddingHorizontal: screenPadding,
          minHeight: 56 + insets.top,
        }}
      >
        <IconButton quiet label={t('lesson.close')} onPress={() => setExiting(true)}>
          <CloseIcon color={colors.text2} />
        </IconButton>
        <ProgressBar value={session.index} max={lesson.steps.length} label={t('lesson.progress')} />
      </View>

      {completion.isError && (
        <View style={{ paddingHorizontal: screenPadding, gap: space[2] }}>
          <Banner>{t('lesson.saveError')}</Banner>
          <Button label={t('lesson.retryLoad')} onPress={() => void submit()} />
        </View>
      )}

      {step && (
        <View key={session.index} style={{ flex: 1 }}>
          {step.type === 'text' && <TextStep step={step} context={context} />}
          {step.type === 'demo' && <DemoStep step={step} context={context} />}
          {step.type === 'move' && <MoveStep step={step} context={context} />}
          {step.type === 'quiz' && <QuizStep step={step} context={context} />}
          {step.type === 'find-squares' && <FindSquaresStep step={step} context={context} />}
        </View>
      )}

      {exiting && (
        <BottomSheet label={t('lesson.exit.title')} onClose={() => setExiting(false)}>
          <Mascot mood="oops" size={80} dark={scheme === 'dark'} />
          <Text style={[typography.h2, { color: colors.text, textAlign: 'center' }]}>
            {t('lesson.exit.title')}
          </Text>
          <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
            {t('lesson.exit.text')}
          </Text>
          <Button large label={t('lesson.exit.stay')} onPress={() => setExiting(false)} />
          <Button variant="danger" label={t('lesson.exit.leave')} onPress={onExit} />
        </BottomSheet>
      )}
    </View>
  );
}
