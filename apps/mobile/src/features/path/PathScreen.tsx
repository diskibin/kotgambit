import { TRACKS } from '@kotgambit/content-schema';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLessonsQuery, useProgressQuery } from '../../app/api';
import { localDateKey } from '../../shared/localDate';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, space, typography } from '../../theme/theme';
import { useSignOut } from '../auth/useSignOut';
import { Mascot } from '../mascot/Mascot';
import { ChapterCard } from './ChapterCard';
import { DayBar } from './DayBar';

const PERCENT = 100;
const CAT = 40;

/** The home screen: the day bar, then the chapters of every track as a list, the current one as a card. */
export function PathScreen({
  onOpenLesson,
  onOpenPuzzles,
  onOpenPlay,
  onOpenAnalysis,
}: {
  onOpenLesson: (id: string) => void;
  onOpenPuzzles: () => void;
  onOpenPlay: () => void;
  onOpenAnalysis: () => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const lessons = useLessonsQuery();
  const progress = useProgressQuery(localDateKey());
  const signOut = useSignOut();

  const catalog = lessons.data?.lessons ?? [];
  const tracks = TRACKS.filter((track) => catalog.some((lesson) => lesson.track === track));
  const current = catalog.find((lesson) => lesson.status === 'available');

  let bubble = '';
  if (current) {
    bubble = t(current.order === 1 ? 'path.bubble.first' : 'path.bubble.next', {
      title: current.title,
    });
  } else if (catalog.length > 0) {
    bubble = t('path.bubble.allDone');
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
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
        <Button variant="text" label={t('puzzles.title')} onPress={onOpenPuzzles} />
        <Button variant="text" label={t('play.title')} onPress={onOpenPlay} />
        <Button variant="text" label={t('analysis.title')} onPress={onOpenAnalysis} />
        <Button variant="text" label={t('path.signOut')} onPress={() => void signOut()} />
      </View>

      {lessons.isError && (
        <View style={{ gap: space[2] }}>
          <Banner>{t('path.loadError')}</Banner>
          <Button label={t('lesson.retryLoad')} onPress={() => void lessons.refetch()} />
        </View>
      )}

      {lessons.isLoading && (
        <Text accessibilityRole="progressbar" style={[typography.body, { color: colors.text2 }]}>
          {t('path.loading')}
        </Text>
      )}

      {tracks.map((track, trackIndex) => {
        const items = catalog.filter((lesson) => lesson.track === track);
        const done = items.filter((lesson) => lesson.status === 'completed').length;
        return (
          <View key={track} style={{ gap: space[3] }}>
            <Text style={[typography.caption, { color: colors.text2, textTransform: 'uppercase' }]}>
              {t('path.section', {
                n: trackIndex + 1,
                about: t(`path.sectionAbout.${track}`, { defaultValue: '' }),
              })}
            </Text>
            <Text accessibilityRole="header" style={[typography.h1, { color: colors.text }]}>
              {t(`tracks.${track}`)}
            </Text>
            <View style={{ gap: space[1] }}>
              <View style={{ flexDirection: 'row' }}>
                <ProgressBar value={done} max={items.length} label={t(`tracks.${track}`)} />
              </View>
              <Text style={[typography.caption, { color: colors.text2 }]}>
                {t('path.progress', {
                  done,
                  total: items.length,
                  percent: Math.round((done / items.length) * PERCENT),
                })}
              </Text>
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
        );
      })}

      {bubble ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            padding: space[3],
            borderRadius: radius.card,
            borderWidth: 2,
            borderColor: colors.line,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={[typography.small, { color: colors.text }]}>{bubble}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
