import { createCoach } from '@kotgambit/coach';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../shared/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { Confetti } from './Confetti';
import type { LessonResult } from './LessonScreen';

const PERCENT = 100;

interface CompleteScreenProps {
  data: LessonResult;
  onRepeat: (id: string) => void;
  onNext: (id: string) => void;
  onHome: () => void;
}

/** After a lesson: the cat, what the learner earned and where to go next. */
export function CompleteScreen({ data, onRepeat, onNext, onHome }: CompleteScreenProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { result } = data;
  const message = useMemo(
    () => createCoach().message({ type: 'LESSON_COMPLETED', accuracy: result.accuracy }),
    [result.accuracy],
  );

  const tiles = [
    { label: t('lesson.complete.xp'), value: t('lesson.complete.xpValue', { xp: result.xp }) },
    {
      label: t('lesson.complete.accuracy'),
      value: t('lesson.complete.accuracyValue', { percent: Math.round(result.accuracy * PERCENT) }),
    },
    {
      label: t('lesson.complete.streak'),
      value: t('lesson.complete.day', { count: result.progress.streakDays }),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {message.effect === 'confetti' && <Confetti />}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[4],
          padding: screenPadding,
          paddingTop: insets.top + screenPadding,
        }}
      >
        <Mascot mood={message.mascot} size={200} dark={scheme === 'dark'} animate />
        <Text
          accessibilityRole="header"
          style={[typography.display, { color: colors.text, textAlign: 'center' }]}
        >
          {message.title}
        </Text>
        <Text style={[typography.bodyL, { color: colors.text2, textAlign: 'center' }]}>
          {t('lesson.complete.subtitleDone')}
        </Text>
        <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: space[3] }}>
          {tiles.map((tile) => (
            <View
              key={tile.label}
              accessible
              accessibilityLabel={`${tile.label}: ${tile.value}`}
              style={{
                flex: 1,
                gap: space[1],
                padding: space[3],
                borderRadius: radius.card,
                borderWidth: 2,
                borderColor: colors.line,
                backgroundColor: colors.surface,
              }}
            >
              <Text
                style={[typography.caption, { color: colors.text2, textTransform: 'uppercase' }]}
              >
                {tile.label}
              </Text>
              <Text style={[typography.h3, { color: colors.text }]}>{tile.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View
        style={{
          gap: space[2],
          padding: screenPadding,
          paddingBottom: insets.bottom + screenPadding,
        }}
      >
        <Button
          variant="success"
          large
          label={t(result.nextLessonId ? 'lesson.complete.next' : 'lesson.complete.home')}
          onPress={() => (result.nextLessonId ? onNext(result.nextLessonId) : onHome())}
        />
        <Button
          variant="secondary"
          label={t('lesson.complete.again')}
          onPress={() => onRepeat(data.lessonId)}
        />
      </View>
    </View>
  );
}
