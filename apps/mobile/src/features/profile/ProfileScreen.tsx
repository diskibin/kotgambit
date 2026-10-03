import { levelPercent, monthGenitive, weekdayShort, yearOf } from '@kotgambit/game-player';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileQuery } from '../../app/api';
import { useSignOut } from '../auth/useSignOut';
import { localDateKey } from '../../shared/localDate';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

const AVATAR = 92;
const CAT = 80;
const DAY_CELL = 36;
const BAR_HEIGHT = 16;

function Tile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value}`}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        gap: 2,
        padding: space[3],
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: colors.line,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={[typography.caption, { color: colors.text2 }]}>{label}</Text>
      <Text style={[typography.h2, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

/** What the learner has done so far: level, streak, the week, achievements and the weak themes. */
export function ProfileScreen({
  onCards,
  onTheme,
  onPremium,
}: {
  onCards: () => void;
  onTheme: (key: string) => void;
  onPremium: () => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfileQuery(localDateKey());
  const signOut = useSignOut();
  const data = profile.data;
  const weakest = data?.themes[0];
  const unlocked = data?.achievements.filter((a) => a.unlocked).length ?? 0;

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
          {t('profile.title')}
        </Text>
      </View>

      {profile.isError && (
        <View style={{ gap: space[2] }}>
          <Banner>{t('profile.loadError')}</Banner>
          <Button label={t('profile.retry')} onPress={() => void profile.refetch()} />
        </View>
      )}
      {profile.isLoading && (
        <Text accessibilityRole="progressbar" style={[typography.body, { color: colors.text2 }]}>
          {t('profile.loading')}
        </Text>
      )}

      {data && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View
              style={{
                width: AVATAR,
                height: AVATAR,
                borderRadius: AVATAR,
                borderWidth: shashka.borderLarge,
                borderColor: colors.edge,
                backgroundColor: colors.brandTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mascot mood="proud" size={CAT} dark={scheme === 'dark'} />
            </View>
            <View style={{ flex: 1, gap: space[1] }}>
              <Text style={[typography.h2, { color: colors.text }]}>
                {data.displayName ?? t('profile.guest')}
              </Text>
              <Text style={[typography.small, { color: colors.text2 }]}>
                {t('profile.level', { level: data.level.level })} ·{' '}
                {t('profile.memberSince', {
                  month: monthGenitive(data.memberSince),
                  year: yearOf(data.memberSince),
                })}
              </Text>
              <Text style={[typography.caption, { color: colors.text2 }]}>
                {t('profile.toNext', {
                  next: data.level.level + 1,
                  xp: data.level.xpInLevel,
                  total: data.level.xpForNext,
                })}
              </Text>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={t('profile.levelBar', { level: data.level.level })}
                accessibilityValue={{
                  min: 0,
                  max: data.level.xpForNext,
                  now: data.level.xpInLevel,
                }}
                style={{
                  height: BAR_HEIGHT,
                  overflow: 'hidden',
                  borderRadius: BAR_HEIGHT,
                  borderWidth: shashka.border,
                  borderColor: colors.edge,
                  backgroundColor: colors.surface,
                }}
              >
                <View
                  style={{
                    width: `${levelPercent(data.level.xpInLevel, data.level.xpForNext)}%`,
                    flex: 1,
                    backgroundColor: colors.sun,
                  }}
                />
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            <Tile
              label={t('profile.tiles.streak')}
              value={t('profile.tiles.streakValue', { count: data.streak.current })}
            />
            <Tile label={t('profile.tiles.xp')} value={String(data.xpTotal)} />
            <Tile label={t('profile.tiles.puzzles')} value={String(data.puzzles.solved)} />
            <Tile label={t('profile.tiles.games')} value={String(data.games.played)} />
          </View>
          <Text style={[typography.small, { color: colors.text2 }]}>
            {t('profile.tiles.puzzlesSub', { rating: data.puzzles.rating })} ·{' '}
            {t('profile.tiles.gamesSub', {
              wins: data.games.wins,
              draws: data.games.draws,
              losses: data.games.losses,
            })}
          </Text>

          <View
            style={{
              gap: space[3],
              padding: space[3],
              borderRadius: radius.card,
              borderWidth: 2,
              borderColor: colors.line,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={[typography.h3, { color: colors.text }]}>{t('profile.week.title')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {data.week.map((day) => (
                <View
                  key={day.day}
                  accessible
                  accessibilityLabel={`${weekdayShort(day.day)}: ${day.done ? t('profile.week.done') : t('profile.week.missed')}${day.today ? `, ${t('profile.week.today')}` : ''}`}
                  style={{ alignItems: 'center', gap: space[1] }}
                >
                  <View
                    style={{
                      width: DAY_CELL,
                      height: DAY_CELL,
                      borderRadius: 8,
                      borderWidth: day.today ? shashka.borderLarge : shashka.border,
                      borderColor: day.today ? colors.brand : colors.edge,
                      backgroundColor: day.done ? colors.boardA : colors.surface,
                    }}
                  />
                  <Text style={[typography.caption, { color: colors.text2 }]}>
                    {weekdayShort(day.day)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[typography.small, { color: colors.flameText }]}>
              {t('profile.week.line', { current: data.streak.current, best: data.streak.best })}
            </Text>
          </View>

          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.h3, { color: colors.text }]}>
                {t('profile.achievements.title')}
              </Text>
              <Text style={[typography.small, { color: colors.text2 }]}>
                {t('profile.achievements.count', {
                  done: unlocked,
                  total: data.achievements.length,
                })}
              </Text>
            </View>
            {data.achievements.map((achievement) => (
              <View
                key={achievement.key}
                accessible
                accessibilityLabel={`${t(`profile.achievements.key.${achievement.key}`)}. ${achievement.unlocked ? t('profile.achievements.unlocked') : t('profile.achievements.progress', { current: achievement.current, target: achievement.target })}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[3],
                  borderRadius: radius.card,
                  borderWidth: 2,
                  borderStyle: achievement.unlocked ? 'solid' : 'dashed',
                  borderColor: achievement.unlocked ? colors.edge : colors.line,
                  backgroundColor: achievement.unlocked ? colors.sunTint : colors.surface,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 36,
                    borderWidth: 2,
                    borderColor: colors.edge,
                    backgroundColor: achievement.unlocked ? colors.sun : colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={[typography.small, { color: colors.onAccent }]}>
                    {achievement.unlocked ? '★' : ''}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.h3, { color: colors.text }]}>
                    {t(`profile.achievements.key.${achievement.key}`)}
                  </Text>
                  <Text style={[typography.small, { color: colors.text2 }]}>
                    {achievement.unlocked
                      ? t('profile.achievements.unlocked')
                      : achievement.current === 0 && achievement.target === 1
                        ? t('profile.achievements.never')
                        : t('profile.achievements.progress', {
                            current: achievement.current,
                            target: achievement.target,
                          })}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ gap: space[2] }}>
            <Text style={[typography.h3, { color: colors.text }]}>{t('profile.themes.title')}</Text>
            <Text style={[typography.small, { color: colors.text2 }]}>
              {t('profile.themes.caption')}
            </Text>
            {data.themes.length === 0 ? (
              <Text style={[typography.body, { color: colors.textMuted }]}>
                {t('profile.themes.none')}
              </Text>
            ) : (
              data.themes.map((theme) => (
                <View
                  key={theme.key}
                  accessible
                  accessibilityLabel={`${theme.title}: ${theme.accuracy}%`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}
                >
                  <Text style={[typography.small, { color: colors.text, width: 120 }]}>
                    {theme.title}
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 10,
                      overflow: 'hidden',
                      borderRadius: 10,
                      backgroundColor: colors.surface2,
                    }}
                  >
                    <View
                      style={{
                        width: `${theme.accuracy}%`,
                        flex: 1,
                        backgroundColor: theme.accuracy < 40 ? colors.coral : colors.mint,
                      }}
                    />
                  </View>
                  <Text
                    style={[
                      typography.small,
                      { color: colors.text, width: 44, textAlign: 'right' },
                    ]}
                  >
                    {theme.accuracy}%
                  </Text>
                </View>
              ))
            )}
            {weakest && (
              <>
                <Text style={[typography.small, { color: colors.text }]}>
                  {t('profile.themes.weakest', { title: weakest.title })}
                </Text>
                <Button
                  variant="secondary"
                  label={t('profile.themes.practice')}
                  onPress={() => onTheme(weakest.key)}
                />
              </>
            )}
          </View>

          <View
            style={{
              gap: space[2],
              padding: space[3],
              borderRadius: radius.card,
              borderWidth: 2,
              borderColor: colors.line,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={[typography.h3, { color: colors.text }]}>{t('profile.cards.title')}</Text>
            <Text style={[typography.small, { color: colors.text2 }]}>
              {data.cards.total === 0
                ? t('profile.cards.none')
                : t('profile.cards.due', { count: data.cards.due })}
            </Text>
            {data.cards.due > 0 && <Button label={t('profile.cards.start')} onPress={onCards} />}
          </View>

          <Button variant="premium" label={t('premium.title')} onPress={onPremium} />
          <Button variant="secondary" label={t('path.signOut')} onPress={() => void signOut()} />
        </>
      )}
    </ScrollView>
  );
}
