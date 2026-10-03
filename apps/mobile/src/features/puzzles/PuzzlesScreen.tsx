import { THEME_GROUPS, themeGroup, type ThemeGroup } from '@kotgambit/puzzle-player';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDailyPuzzleQuery, usePuzzleStatsQuery, usePuzzleThemesQuery } from '../../app/api';
import { localDateKey } from '../../shared/localDate';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { Tabs } from '../../shared/ui/Tabs';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { PositionPreview } from './PositionPreview';

type Filter = 'all' | ThemeGroup;

const FILTERS: readonly Filter[] = ['all', ...THEME_GROUPS];
const PREVIEW = 112;
const CAT = 56;

export interface PuzzleRequest {
  mode: 'rating' | 'theme' | 'review' | 'daily';
  theme?: string;
}

/** The puzzle catalog: the puzzle of the day, the way back to mistakes and the themes with their progress. */
export function PuzzlesScreen({ onOpen }: { onOpen: (request: PuzzleRequest) => void }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const daily = useDailyPuzzleQuery(localDateKey());
  const stats = usePuzzleStatsQuery();
  const themes = usePuzzleThemesQuery();
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(
    () =>
      (themes.data?.themes ?? []).filter(
        (theme) => filter === 'all' || themeGroup(theme.key) === filter,
      ),
    [themes.data, filter],
  );
  const failed = [daily, stats, themes].some((query) => query.isError);
  const loading = [daily, stats, themes].some((query) => query.isLoading);

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
        <Text accessibilityRole="header" style={[typography.h1, { color: colors.text, flex: 1 }]}>
          {t('puzzles.title')}
        </Text>
        {stats.data && (
          <View
            style={{
              borderRadius: radius.pill,
              backgroundColor: colors.skyTint,
              paddingHorizontal: space[3],
              paddingVertical: space[1],
            }}
          >
            <Text style={[typography.small, { color: colors.skyText }]}>
              {t('puzzles.solve.ratingChip', { rating: stats.data.rating })}
            </Text>
          </View>
        )}
      </View>

      {failed && (
        <View style={{ gap: space[2] }}>
          <Banner>{t('puzzles.loadError')}</Banner>
          <Button
            label={t('puzzles.retry')}
            onPress={() => {
              void daily.refetch();
              void stats.refetch();
              void themes.refetch();
            }}
          />
        </View>
      )}

      {loading && (
        <Text accessibilityRole="progressbar" style={[typography.body, { color: colors.text2 }]}>
          {t('puzzles.loading')}
        </Text>
      )}

      {daily.data && (
        <View style={{ marginRight: shashka.offsetLarge, marginBottom: shashka.offsetLarge }}>
          {/* The offset underlay is the "shashka" shadow of a large element */}
          <View
            style={{
              position: 'absolute',
              left: shashka.offsetLarge,
              top: shashka.offsetLarge,
              right: -shashka.offsetLarge,
              bottom: -shashka.offsetLarge,
              borderRadius: radius.card,
              backgroundColor: colors.edge,
            }}
          />
          <View
            accessibilityRole="summary"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              padding: space[3],
              borderRadius: radius.card,
              borderWidth: shashka.borderLarge,
              borderColor: colors.edge,
              backgroundColor: colors.sunTint,
            }}
          >
            <PositionPreview
              fen={daily.data.fen}
              orientation={daily.data.solver}
              size={PREVIEW}
              label={t('puzzles.daily.boardLabel')}
            />
            <View style={{ flex: 1, gap: space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Mascot mood="hint" size={CAT} dark={scheme === 'dark'} />
                <View
                  style={{
                    borderRadius: radius.pill,
                    backgroundColor: colors.sun,
                    paddingHorizontal: space[2],
                    paddingVertical: 2,
                  }}
                >
                  <Text style={[typography.caption, { color: colors.onAccent }]}>
                    {t('puzzles.daily.chip')}
                  </Text>
                </View>
              </View>
              <Text style={[typography.h3, { color: colors.text }]}>{daily.data.title}</Text>
              <Text style={[typography.small, { color: colors.text2 }]}>
                {daily.data.solved
                  ? t('puzzles.daily.solved')
                  : t(`puzzles.turn.${daily.data.solver}`)}
              </Text>
              <Button
                label={daily.data.solved ? t('puzzles.daily.again') : t('puzzles.daily.solve')}
                onPress={() => onOpen({ mode: 'daily' })}
              />
            </View>
          </View>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('puzzles.mistakes.title')}
        onPress={() => onOpen({ mode: 'review' })}
        style={{
          minHeight: 72,
          justifyContent: 'center',
          gap: space[1],
          padding: space[4],
          borderRadius: radius.card,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.sunDepth,
          backgroundColor: colors.surface,
        }}
      >
        <Text style={[typography.h3, { color: colors.text }]}>{t('puzzles.mistakes.title')}</Text>
        <Text style={[typography.small, { color: colors.text2 }]}>
          {t('puzzles.mistakes.text')}
        </Text>
      </Pressable>

      <Text accessibilityRole="header" style={[typography.h2, { color: colors.text }]}>
        {t('puzzles.themes.title')}
      </Text>
      <Tabs
        label={t('puzzles.themes.filterLabel')}
        tabs={FILTERS.map((id) => ({ id, label: t(`puzzles.themes.filter.${id}`) }))}
        value={filter}
        onChange={setFilter}
      />

      {themes.data && shown.length === 0 && (
        <Text style={[typography.body, { color: colors.text2 }]}>{t('puzzles.themes.none')}</Text>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {shown.map((theme) => (
          <Pressable
            key={theme.key}
            accessibilityRole="button"
            accessibilityLabel={`${theme.title}. ${t('puzzles.themes.solvedOf', {
              solved: theme.solved,
              count: theme.count,
            })}`}
            onPress={() => onOpen({ mode: 'theme', theme: theme.key })}
            style={{
              flexGrow: 1,
              flexBasis: '45%',
              minHeight: 112,
              gap: space[2],
              padding: space[3],
              borderRadius: radius.card,
              borderWidth: 2,
              borderColor: colors.line,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={[typography.h3, { color: colors.text }]}>{theme.title}</Text>
            <Text style={[typography.small, { color: colors.text2 }]}>
              {t('puzzles.themes.solvedOf', { solved: theme.solved, count: theme.count })}
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <ProgressBar
                value={theme.solved}
                max={theme.count}
                label={t('puzzles.themes.progress', { title: theme.title })}
              />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
