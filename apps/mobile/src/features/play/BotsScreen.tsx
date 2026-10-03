import { apiErrorOf, type CreateGameRequest } from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveGameQuery, useBotsQuery, useCreateGameMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, size, space, typography } from '../../theme/theme';
import { BotAvatar } from './BotAvatar';

type Color = CreateGameRequest['color'];

const COLORS: readonly Color[] = ['w', 'b', 'random'];
const LEVELS = [1, 2, 3, 4, 5, 6] as const;
const AVATAR = 48;
const PIP = 8;
// The fox: sly, but not too strong, a good first opponent (mobile/screens/play.md)
const DEFAULT_BOT = 'alisa';

interface BotsScreenProps {
  onStart: (gameId: string) => void;
}

/** Choosing the opponent and the color before a game; the learning mode is on, as the design has no switch here. */
export function BotsScreen({ onStart }: BotsScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bots = useBotsQuery();
  const active = useActiveGameQuery();
  const [create, creation] = useCreateGameMutation();
  const [botId, setBotId] = useState(DEFAULT_BOT);
  const [color, setColor] = useState<Color>('w');
  const [message, setMessage] = useState('');

  const list = bots.data?.bots ?? [];
  const chosen = list.find((bot) => bot.id === botId) ?? list[0];
  const unfinished = active.data?.game ?? null;
  const unfinishedBot = list.find((bot) => bot.id === unfinished?.botId);

  async function start() {
    if (!chosen) return;
    setMessage('');
    const result = await create({ botId: chosen.id, color, learning: true });
    if ('data' in result && result.data) {
      onStart(result.data.id);
      return;
    }
    setMessage(apiErrorOf(result.error)?.message ?? t('play.pick.startError'));
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
        <Text accessibilityRole="header" style={[typography.h1, { color: colors.text, flex: 1 }]}>
          {t('play.title')}
        </Text>
      </View>
      <Text style={[typography.body, { color: colors.text2 }]}>{t('play.pick.subtitle')}</Text>

      {bots.isError && (
        <View style={{ gap: space[2] }}>
          <Banner>{t('play.loadError')}</Banner>
          <Button label={t('play.retry')} onPress={() => void bots.refetch()} />
        </View>
      )}
      {bots.isLoading && (
        <Text accessibilityRole="progressbar" style={[typography.body, { color: colors.text2 }]}>
          {t('play.loading')}
        </Text>
      )}

      {unfinished && unfinishedBot && (
        <View
          accessible
          accessibilityLabel={`${t('play.pick.resume.title')}. ${t('play.pick.resume.text', { name: unfinishedBot.instrumental })}`}
          style={{
            gap: space[3],
            padding: space[3],
            borderRadius: radius.card,
            borderWidth: shashka.border,
            borderColor: colors.edge,
            backgroundColor: colors.sunTint,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <BotAvatar kind={unfinishedBot.kind} size={AVATAR} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { color: colors.text }]}>
                {t('play.pick.resume.title')}
              </Text>
              <Text style={[typography.small, { color: colors.text2 }]}>
                {t('play.pick.resume.text', { name: unfinishedBot.instrumental })}
              </Text>
            </View>
          </View>
          <Button label={t('play.pick.resume.button')} onPress={() => onStart(unfinished.id)} />
        </View>
      )}

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('play.pick.botsLabel')}
        style={{ gap: space[2] }}
      >
        {list.map((bot) => {
          const selected = bot.id === chosen?.id;
          return (
            <View
              key={bot.id}
              style={{ paddingRight: shashka.offset, paddingBottom: shashka.offset }}
            >
              {selected && (
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
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${bot.name}. ${bot.summary}. ${t('play.pick.level', { level: bot.level })}`}
                onPress={() => setBotId(bot.id)}
                style={{
                  minHeight: size.chapterRow,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[2],
                  borderRadius: radius.card,
                  borderWidth: selected ? shashka.borderLarge : shashka.border,
                  borderColor: selected ? colors.edge : colors.line,
                  backgroundColor: selected ? colors.brandTint : colors.surface,
                }}
              >
                <BotAvatar kind={bot.kind} size={AVATAR} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.h3, { color: colors.text }]}>{bot.name}</Text>
                  <Text style={[typography.small, { color: colors.text2 }]}>{bot.summary}</Text>
                </View>
                <View accessibilityElementsHidden style={{ flexDirection: 'row', gap: 3 }}>
                  {LEVELS.map((n) => (
                    <View
                      key={n}
                      style={{
                        width: PIP,
                        height: PIP,
                        borderRadius: PIP,
                        backgroundColor: n <= bot.level ? colors.sun : colors.line,
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('play.pick.colorTitle')}
        style={{
          flexDirection: 'row',
          gap: space[1],
          padding: space[1],
          borderRadius: radius.control,
          backgroundColor: colors.surface2,
        }}
      >
        {COLORS.map((value) => {
          const selected = color === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setColor(value)}
              style={{
                flex: 1,
                minHeight: size.tapMin,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.input,
                borderWidth: shashka.border,
                borderColor: selected ? colors.edge : 'transparent',
                backgroundColor: selected ? colors.surface : 'transparent',
              }}
            >
              <Text style={[typography.button, { color: selected ? colors.text : colors.text2 }]}>
                {t(`play.pick.color.${value}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {message ? <Banner>{message}</Banner> : null}
      {chosen && (
        <Button
          large
          busy={creation.isLoading}
          disabled={creation.isLoading}
          label={t('play.pick.startWith', { name: chosen.instrumental })}
          onPress={() => void start()}
        />
      )}
    </ScrollView>
  );
}
