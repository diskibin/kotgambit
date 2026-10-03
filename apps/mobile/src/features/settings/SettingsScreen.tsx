import { monthGenitive } from '@kotgambit/game-player';
import { DAILY_GOAL_MINUTES } from '@kotgambit/contracts';
import { BOARD_THEMES, type BoardTheme, type ThemePreference } from '@kotgambit/preferences';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useDeleteAccountMutation,
  useMeQuery,
  useSettingsQuery,
  useSubscriptionQuery,
  useUpdateSettingsMutation,
} from '../../app/api';
import { useAppDispatch } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from '../../shared/ui/icons';
import { Tabs } from '../../shared/ui/Tabs';
import { TextField } from '../../shared/ui/TextField';
import { boardPalette } from '../../theme/board';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, size, space, typography } from '../../theme/theme';
import { useSignOut } from '../auth/useSignOut';
import { Mascot } from '../mascot/Mascot';
import {
  boardThemeChanged,
  coordinatesChanged,
  reduceMotionChanged,
  themeChanged,
  vibrationChanged,
} from './ui.slice';
import { useUiPreferences } from './useUiPreferences';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const PREVIEW = 56;
const PREVIEW_CELLS = 4;
const DELETE_CAT = 72;

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        gap: space[3],
        padding: space[4],
        borderRadius: radius.card,
        borderWidth: shashka.border,
        borderColor: colors.line,
        backgroundColor: colors.surface,
      }}
    >
      <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function SwitchRow({
  label,
  text,
  value,
  onChange,
}: {
  label: string;
  text: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: size.tapMin }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.button, { color: colors.text }]}>{label}</Text>
        <Text style={[typography.small, { color: colors.text2 }]}>{text}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.brand }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

/** A small board in the colors of a theme, 4 by 4 squares. */
function BoardPreview({ theme }: { theme: BoardTheme }) {
  const { colors, scheme } = useTheme();
  const palette = boardPalette(theme, scheme, colors);
  const cell = PREVIEW / PREVIEW_CELLS;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: PREVIEW,
        height: PREVIEW,
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderRadius: radius.input - 4,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: PREVIEW_CELLS * PREVIEW_CELLS }, (_, index) => {
        const light = (Math.floor(index / PREVIEW_CELLS) + index) % 2 === 0;
        return (
          <View
            key={index}
            style={{
              width: cell,
              height: cell,
              backgroundColor: light ? palette.light : palette.dark,
            }}
          />
        );
      })}
    </View>
  );
}

function BoardChoice({
  theme,
  selected,
  onSelect,
}: {
  theme: BoardTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = t(`settings.board.themes.${theme}`);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={{
        flexBasis: '22%',
        flexGrow: 1,
        minHeight: size.tapMin,
        alignItems: 'center',
        gap: space[1],
        padding: space[2],
        borderRadius: radius.control,
        borderWidth: selected ? shashka.borderLarge : shashka.border,
        borderColor: selected ? colors.brand : colors.line,
        backgroundColor: selected ? colors.brandTint : colors.surface,
      }}
    >
      <BoardPreview theme={theme} />
      <Text style={[typography.caption, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function formatDate(day: string): string {
  const date = new Date(day);
  return `${date.getUTCDate()} ${monthGenitive(day.slice(0, 10))}`;
}

/** Looks, board, motion, the goal of the day and the account: what the learner can change on this phone. */
export function SettingsScreen({
  onBack,
  onPremium,
}: {
  onBack: () => void;
  onPremium: () => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const preferences = useUiPreferences();
  const me = useMeQuery();
  const settings = useSettingsQuery();
  const subscription = useSubscriptionQuery();
  const [updateSettings, updating] = useUpdateSettingsMutation();
  const [deleteAccount, deleting] = useDeleteAccountMutation();
  const signOut = useSignOut();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');

  const word = t('settings.delete.word');
  const subscriptionEnd = subscription.data?.currentPeriodEnd ?? null;
  const premium = subscription.data?.premium === true;

  async function remove() {
    const result = await deleteAccount();
    // The account is gone, so is the session: signing out only clears what this phone still holds
    if (!('error' in result)) await signOut();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: screenPadding,
          paddingTop: insets.top + space[2],
          paddingBottom: insets.bottom + screenPadding,
          gap: space[4],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <IconButton quiet label={t('settings.back')} onPress={onBack}>
            <ChevronLeftIcon color={colors.text} />
          </IconButton>
          <Text accessibilityRole="header" style={[typography.h1, { color: colors.text, flex: 1 }]}>
            {t('settings.title')}
          </Text>
        </View>

        {settings.isError && (
          <View style={{ gap: space[2] }}>
            <Banner>{t('settings.loadError')}</Banner>
            <Button label={t('settings.retry')} onPress={() => void settings.refetch()} />
          </View>
        )}

        <Group title={t('settings.appearance.title')}>
          <Tabs
            label={t('settings.appearance.theme')}
            tabs={THEMES.map((id) => ({ id, label: t(`settings.appearance.${id}`) }))}
            value={preferences.theme}
            onChange={(id) => dispatch(themeChanged(id))}
          />
        </Group>

        <Group title={t('settings.board.title')}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('settings.board.theme')}
            style={{ flexDirection: 'row', gap: space[2] }}
          >
            {BOARD_THEMES.map((theme) => (
              <BoardChoice
                key={theme}
                theme={theme}
                selected={preferences.boardTheme === theme}
                onSelect={() => dispatch(boardThemeChanged(theme))}
              />
            ))}
          </View>
          <SwitchRow
            label={t('settings.board.coordinates.title')}
            text={t('settings.board.coordinates.text')}
            value={preferences.coordinates}
            onChange={(value) => dispatch(coordinatesChanged(value))}
          />
        </Group>

        <Group title={t('settings.motion.title')}>
          <SwitchRow
            label={t('settings.appearance.vibration.title')}
            text={t('settings.appearance.vibration.text')}
            value={preferences.vibration}
            onChange={(value) => dispatch(vibrationChanged(value))}
          />
          <SwitchRow
            label={t('settings.appearance.reduce.title')}
            text={t('settings.appearance.reduce.text')}
            value={preferences.reduceMotion}
            onChange={(value) => dispatch(reduceMotionChanged(value))}
          />
        </Group>

        <Group title={t('settings.study.title')}>
          <Text style={[typography.button, { color: colors.text }]}>
            {t('settings.goal.title')}
          </Text>
          <Tabs
            label={t('settings.goal.title')}
            tabs={DAILY_GOAL_MINUTES.map((minutes) => ({
              id: String(minutes),
              label: t('settings.goal.minutes', { count: minutes }),
            }))}
            value={String(settings.data?.dailyGoalMinutes ?? 10)}
            onChange={(id) => void updateSettings({ dailyGoalMinutes: Number(id) as 5 | 10 | 15 })}
          />
          {updating.isError && <Banner>{t('settings.goal.error')}</Banner>}
        </Group>

        <Group title={t('settings.account.title')}>
          <View style={{ minHeight: size.tapMin, justifyContent: 'center' }}>
            <Text style={[typography.small, { color: colors.text2 }]}>
              {t('settings.account.email')}
            </Text>
            <Text style={[typography.button, { color: colors.text }]}>{me.data?.email}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('settings.account.subscription')}. ${premium && subscriptionEnd ? t('settings.account.premiumUntil', { date: formatDate(subscriptionEnd) }) : premium ? t('settings.account.premium') : t('settings.account.free')}`}
            onPress={onPremium}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2],
              minHeight: size.tapMin,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.small, { color: colors.text2 }]}>
                {t('settings.account.subscription')}
              </Text>
              <Text style={[typography.button, { color: colors.text }]}>
                {premium && subscriptionEnd
                  ? t('settings.account.premiumUntil', { date: formatDate(subscriptionEnd) })
                  : premium
                    ? t('settings.account.premium')
                    : t('settings.account.free')}
              </Text>
            </View>
            <ChevronRightIcon color={colors.text2} />
          </Pressable>
          <Button
            variant="danger"
            label={t('settings.account.delete')}
            onPress={() => setConfirming(true)}
          />
        </Group>
      </ScrollView>

      {confirming && (
        <BottomSheet label={t('settings.delete.title')} onClose={() => setConfirming(false)}>
          <Mascot mood="oops" size={DELETE_CAT} dark={scheme === 'dark'} />
          <Text style={[typography.h2, { color: colors.text, textAlign: 'center' }]}>
            {t('settings.delete.title')}
          </Text>
          <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
            {t('settings.delete.textMobile')}
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <TextField
              label={t('settings.delete.confirmLabelMobile')}
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="none"
            />
          </View>
          {deleting.isError && <Banner>{t('settings.delete.error')}</Banner>}
          <View style={{ alignSelf: 'stretch', gap: space[2] }}>
            <Button large label={t('settings.delete.keep')} onPress={() => setConfirming(false)} />
            <Button
              variant="danger"
              label={t('settings.delete.confirm')}
              disabled={typed.trim().toLowerCase() !== word || deleting.isLoading}
              onPress={() => void remove()}
            />
          </View>
        </BottomSheet>
      )}
    </View>
  );
}
