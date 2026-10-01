import type { LessonSummary } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../shared/ui/Button';
import { LockIcon, StarIcon } from '../../shared/ui/icons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shashka, size, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { MiniBoard } from './MiniBoard';

const STARS = 3;
const ROW_HEIGHT = 60;
const TILE = 44;
const CURRENT_BOARD = 136;

function Stars({ count }: { count: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('path.stars', { count })}
      style={{ flexDirection: 'row', gap: 2 }}
    >
      {Array.from({ length: STARS }, (_, index) => (
        <StarIcon
          key={index}
          size={16}
          color={index < count ? colors.sunDepth : colors.lineStrong}
        />
      ))}
    </View>
  );
}

interface ChapterCardProps {
  lesson: LessonSummary;
  /** The chapter to do now: it gets the big card with a button. */
  current: boolean;
  onOpen: (id: string) => void;
  dark: boolean;
}

/** A chapter in the list. Its look tells where the learner is: done, now, closed or premium. */
export function ChapterCard({ lesson, current, onOpen, dark }: ChapterCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = t('path.chapter', { n: lesson.order });

  if (lesson.status === 'premium' || lesson.status === 'locked') {
    const premium = lesson.status === 'premium';
    return (
      <View
        accessible
        accessibilityLabel={`${label}. ${lesson.title}. ${t(premium ? 'path.premiumText' : 'path.locked')}`}
        style={{
          minHeight: ROW_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          padding: space[3],
          borderRadius: radius.chapter,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: premium ? colors.sunDepth : colors.dashed,
          backgroundColor: premium ? colors.sunTint : colors.surface,
        }}
      >
        <LockIcon color={premium ? colors.sunText : colors.text2} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, { color: premium ? colors.sunText : colors.text2 }]}>
            {label}
          </Text>
          <Text style={[typography.small, { color: colors.text, fontFamily: 'Unbounded-Bold' }]}>
            {lesson.title}
          </Text>
          <Text style={[typography.caption, { color: premium ? colors.sunText : colors.text2 }]}>
            {t(premium ? 'path.premiumText' : 'path.locked')}
          </Text>
        </View>
        {premium && (
          <View
            style={{
              paddingHorizontal: space[2],
              paddingVertical: 2,
              borderRadius: radius.pill,
              borderWidth: 2,
              borderColor: colors.edge,
              backgroundColor: colors.sun,
            }}
          >
            <Text style={[typography.caption, { color: colors.onAccent }]}>
              {t('path.premium')}
            </Text>
          </View>
        )}
      </View>
    );
  }

  if (current) {
    return (
      <View
        style={{
          paddingRight: shashka.offsetLarge,
          paddingBottom: shashka.offsetLarge,
          paddingTop: 36,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: shashka.offsetLarge,
            top: shashka.offsetLarge + 36,
            right: 0,
            bottom: 0,
            borderRadius: radius.chapter,
            backgroundColor: colors.edge,
          }}
        />
        <View style={{ position: 'absolute', top: 0, right: space[4], zIndex: 1 }}>
          <Mascot mood="wave" size={64} dark={dark} animate />
        </View>
        <View
          style={{
            gap: space[3],
            padding: space[3],
            borderRadius: radius.chapter,
            borderWidth: shashka.borderLarge,
            borderColor: colors.edge,
            backgroundColor: colors.brandTint,
          }}
        >
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <MiniBoard piece={lesson.piece} size={CURRENT_BOARD} moves />
            <View style={{ flex: 1, gap: space[1], justifyContent: 'center' }}>
              <Text style={[typography.caption, { color: colors.brandText }]}>
                {t(lesson.order === 1 ? 'path.chapterFirst' : 'path.chapterNow', {
                  n: lesson.order,
                })}
              </Text>
              <Text style={[typography.h3, { color: colors.text }]}>{lesson.title}</Text>
              <Text style={[typography.small, { color: colors.text2 }]}>
                {t('path.meta', { steps: lesson.stepCount, minutes: lesson.minutes })}
              </Text>
            </View>
          </View>
          <Button
            large
            label={t(lesson.order === 1 ? 'path.start' : 'path.continue')}
            onPress={() => onOpen(lesson.id)}
          />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${lesson.title}. ${t('path.repeat')}`}
      onPress={() => onOpen(lesson.id)}
      style={{
        minHeight: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        padding: space[3],
        borderRadius: radius.chapter,
        borderWidth: shashka.border,
        borderColor: colors.edge,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          width: TILE,
          height: TILE,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.control,
          backgroundColor: colors.surface2,
        }}
      >
        <MiniBoard piece={lesson.piece} size={TILE - 8} />
      </View>
      <View style={{ flex: 1, minHeight: size.tapMin, justifyContent: 'center' }}>
        <Text style={[typography.caption, { color: colors.text2 }]}>{label}</Text>
        <Text style={[typography.small, { color: colors.text, fontFamily: 'Unbounded-Bold' }]}>
          {lesson.title}
        </Text>
      </View>
      <Stars count={lesson.stars} />
    </Pressable>
  );
}
