import { TRACKS } from '@kotgambit/content-schema';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useDailyPuzzleQuery, useLessonsQuery, useProgressQuery } from '../../app/api';
import { localDateKey } from '../../shared/localDate';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { ChevronRightIcon } from '../../shared/ui/icons';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, size, space, typography } from '../../theme/theme';
import { Piece } from '../board/Piece';
import { Mascot } from '../mascot/Mascot';
import { ChapterCard } from './ChapterCard';
import { DayBar } from './DayBar';
import { streakSeen } from './streak.slice';

const CAT = 40;
const TILE = 44;
const BAR_HEIGHT = 12;

/** The home screen: the day bar, the chapters of the current section as a list, and the puzzle of the day. */
export function PathScreen({
  onOpenLesson,
  onOpenTasks,
}: {
  onOpenLesson: (id: string) => void;
  onOpenTasks: () => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const lessons = useLessonsQuery();
  const progress = useProgressQuery(localDateKey());
  const daily = useDailyPuzzleQuery(localDateKey());
  const dispatch = useAppDispatch();
  const [closedAt, setClosedAt] = useState<number | null>(null);

  const catalog = lessons.data?.lessons ?? [];
  const tracks = TRACKS.filter((track) => catalog.some((lesson) => lesson.track === track));
  const current = catalog.find((lesson) => lesson.status === 'available');
  // The section being learned is the one with the chapter to do now, the last one when everything is done
  const track = current?.track ?? tracks[tracks.length - 1];
  const items = catalog.filter((lesson) => lesson.track === track);
  const done = items.filter((lesson) => lesson.status === 'completed').length;
  const finished = items.length > 0 && done === items.length;

  // The first look at the chapters only remembers the streak; a longer one on a later look is celebrated
  const streak = progress.data?.streakDays;
  const seen = useAppSelector((state) => state.streak.seen);
  const celebrate = streak !== undefined && seen !== null && streak > seen && closedAt !== streak;
  useEffect(() => {
    if (streak !== undefined && !celebrate) dispatch(streakSeen(streak));
  }, [streak, celebrate, dispatch]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: screenPadding,
          paddingTop: insets.top + screenPadding,
          paddingBottom: insets.bottom + screenPadding,
          gap: space[4],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Mascot mood={current ? 'wave' : 'proud'} size={CAT} dark={scheme === 'dark'} />
          <View style={{ flex: 1 }}>{progress.data && <DayBar progress={progress.data} />}</View>
        </View>

        {lessons.isError && (
          <View style={{ gap: space[2] }}>
            <Banner>{t('path.loadError')}</Banner>
            <Button label={t('lesson.retryLoad')} onPress={() => void lessons.refetch()} />
          </View>
        )}

        {lessons.isLoading && (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t('path.loading')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
          >
            <Mascot mood="thinking" size={72} dark={scheme === 'dark'} />
            <Text style={[typography.small, { color: colors.text2, flex: 1 }]}>
              {t('path.loadingTitle')}
            </Text>
          </View>
        )}

        {track && (
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View
                style={{
                  width: TILE,
                  height: TILE,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.control,
                  borderWidth: shashka.border,
                  borderColor: colors.edge,
                  backgroundColor: finished ? colors.mint : colors.brand,
                }}
              >
                <Piece color="w" type="k" size={size.icon + 8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[typography.caption, { color: colors.text2, textTransform: 'uppercase' }]}
                >
                  {t('path.sectionCount', {
                    n: tracks.indexOf(track) + 1,
                    done,
                    total: items.length,
                  })}
                </Text>
                <Text accessibilityRole="header" style={[typography.h2, { color: colors.text }]}>
                  {t(`tracks.${track}`)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', height: BAR_HEIGHT }}>
              <ProgressBar value={done} max={items.length} label={t(`tracks.${track}`)} />
            </View>
            {items.map((lesson) => (
              <ChapterCard
                key={lesson.id}
                lesson={lesson}
                current={lesson.id === current?.id}
                dark={scheme === 'dark'}
                onOpen={onOpenLesson}
              />
            ))}
          </View>
        )}

        {daily.data && (
          <View>
            <View
              style={{
                position: 'absolute',
                left: shashka.offset,
                top: shashka.offset,
                right: -shashka.offset,
                bottom: -shashka.offset,
                borderRadius: radius.card,
                backgroundColor: colors.edge,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('path.daily.title')}. ${daily.data.title}`}
              onPress={onOpenTasks}
              style={{
                minHeight: size.tapMin + space[4],
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                padding: space[3],
                borderRadius: radius.card,
                borderWidth: shashka.border,
                borderColor: colors.edge,
                backgroundColor: colors.sunTint,
              }}
            >
              <View
                style={{
                  width: TILE,
                  height: TILE,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.control,
                  backgroundColor: colors.surface,
                }}
              >
                <Piece color="w" type="r" size={size.icon + 8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.sunText, textTransform: 'uppercase' },
                  ]}
                >
                  {t('path.daily.title')}
                </Text>
                <Text style={[typography.button, { color: colors.text }]}>{daily.data.title}</Text>
              </View>
              <ChevronRightIcon color={colors.text2} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {celebrate && streak !== undefined && (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: screenPadding,
            right: screenPadding,
            bottom: space[2],
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[3],
            borderRadius: radius.card,
            borderWidth: shashka.border,
            borderColor: colors.edge,
            backgroundColor: colors.flameTint,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.button, { color: colors.flameText }]}>
              {t('path.toastMobile.title', { count: streak })}
            </Text>
            <Text style={[typography.small, { color: colors.text2 }]}>
              {t('path.toastMobile.text')}
            </Text>
          </View>
          <Button
            variant="text"
            label={t('path.toastMobile.ok')}
            onPress={() => {
              dispatch(streakSeen(streak));
              setClosedAt(streak);
            }}
          />
        </View>
      )}
    </View>
  );
}
