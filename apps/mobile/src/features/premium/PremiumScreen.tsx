import type { CheckoutResponse, PlanKeyValue, SubscriptionView } from '@kotgambit/contracts';
import { formatDay } from '@kotgambit/game-player';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useCancelSubscriptionMutation,
  useCheckoutMutation,
  usePlansQuery,
  useResumeSubscriptionMutation,
  useSubscriptionQuery,
} from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { TermsText } from '../../shared/ui/TermsText';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, size, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

const MONTHS_IN_YEAR = 12;
const TABLE_ROWS = ['puzzles', 'review', 'analysis', 'tracks', 'cards'] as const;
// What a row says for a free learner and for a subscriber, keys of `premium.table.cell`
const TABLE_CELLS: Record<(typeof TABLE_ROWS)[number], readonly [string, string]> = {
  puzzles: ['puzzlesFree', 'unlimited'],
  review: ['brief', 'full'],
  analysis: ['analysisFree', 'unlimited'],
  tracks: ['firstLessons', 'yes'],
  cards: ['no', 'yes'],
};

const cellText = (key: string, t: (k: string) => string) =>
  key === 'yes' ? '✓' : key === 'no' ? '—' : t(`premium.table.cell.${key}`);

interface PremiumScreenProps {
  onBack: () => void;
  /** A payment was created: open its page. */
  onCheckout: (checkout: CheckoutResponse) => void;
}

/** The plans and what Premium opens, or what the learner has: the subscription, its end and the way to cancel. */
export function PremiumScreen({ onBack, onCheckout }: PremiumScreenProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const subscription = useSubscriptionQuery();
  const data = subscription.data;

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
          {t('premium.title')}
        </Text>
        <Button variant="text" label={t('lesson.complete.home')} onPress={onBack} />
      </View>

      {subscription.isError && (
        <View style={{ gap: space[2] }}>
          <Banner>{t('premium.loadError')}</Banner>
          <Button label={t('premium.retry')} onPress={() => void subscription.refetch()} />
        </View>
      )}
      {subscription.isLoading && (
        <Text accessibilityRole="progressbar" style={[typography.body, { color: colors.text2 }]}>
          {t('premium.loading')}
        </Text>
      )}
      {data && (data.status === 'active' || data.status === 'past_due') && (
        <Active subscription={data} scheme={scheme} />
      )}
      {data && data.status === 'canceled' && <Canceled subscription={data} scheme={scheme} />}
      {data && (data.status === 'none' || data.status === 'expired') && (
        <Offer expired={data.status === 'expired'} scheme={scheme} onCheckout={onCheckout} />
      )}
    </ScrollView>
  );
}

function Offer({
  expired,
  scheme,
  onCheckout,
}: {
  expired: boolean;
  scheme: 'light' | 'dark';
  onCheckout: (checkout: CheckoutResponse) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const plans = usePlansQuery();
  const [checkout, order] = useCheckoutMutation();
  const [plan, setPlan] = useState<PlanKeyValue>('year');
  const [autoRenew, setAutoRenew] = useState(false);

  const list = plans.data?.plans ?? [];

  async function start() {
    const result = await checkout({ plan, client: 'mobile', autoRenew });
    if ('data' in result && result.data) onCheckout(result.data);
  }

  if (plans.data && !plans.data.available) return <Banner>{t('premium.unavailable')}</Banner>;

  return (
    <>
      <View style={{ alignItems: 'center', gap: space[2] }}>
        <Mascot mood="proud" size={84} accessory="crown" dark={scheme === 'dark'} />
        <Text
          accessibilityRole="header"
          style={[typography.h1, { color: colors.text, textAlign: 'center' }]}
        >
          {t('premium.offer.title')}
        </Text>
        <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
          {expired ? t('premium.offer.expired') : t('premium.offer.text')}
        </Text>
      </View>

      <View style={{ gap: space[2], paddingRight: shashka.offset }}>
        {list.map((item) => {
          const selected = plan === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${t(`premium.offer.${item.key}.name`)}. ${t(`premium.offer.${item.key}.price`, { price: item.priceRub })}`}
              onPress={() => setPlan(item.key)}
              style={{
                minHeight: size.tapMin,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                padding: space[3],
                borderRadius: radius.card,
                borderWidth: selected ? shashka.borderLarge : shashka.border,
                borderColor: selected ? colors.edge : colors.line,
                backgroundColor: selected ? colors.sunTint : colors.surface,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: colors.text }]}>
                  {t(`premium.offer.${item.key}.name`)}
                </Text>
                <Text style={[typography.small, { color: colors.text2 }]}>
                  {t(`premium.offer.${item.key}.price`, { price: item.priceRub })}
                </Text>
                {item.key === 'year' && (
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {t('premium.offer.year.note', {
                      perMonth: Math.round(item.priceRub / MONTHS_IN_YEAR),
                    })}
                  </Text>
                )}
              </View>
              {item.key === 'year' && (
                <View
                  style={{
                    borderRadius: radius.pill,
                    backgroundColor: colors.sun,
                    paddingHorizontal: space[2],
                    paddingVertical: 2,
                  }}
                >
                  <Text style={[typography.caption, { color: colors.onAccent }]}>
                    {t('premium.offer.year.badge')}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: autoRenew }}
        accessibilityLabel={t('premium.offer.autoRenew')}
        onPress={() => setAutoRenew(!autoRenew)}
        style={{
          minHeight: size.tapMin,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            borderWidth: shashka.border,
            borderColor: colors.edge,
            backgroundColor: autoRenew ? colors.brand : colors.surface,
          }}
        />
        <Text style={[typography.button, { color: colors.text }]}>
          {t('premium.offer.autoRenew')}
        </Text>
      </Pressable>
      <TermsText i18nKey="premium.offer.terms" />

      {order.isError && <Banner>{t('premium.offer.startError')}</Banner>}
      <Button
        large
        variant="premium"
        busy={order.isLoading}
        disabled={order.isLoading || list.length === 0}
        label={order.isLoading ? t('premium.offer.starting') : t('premium.offer.start')}
        onPress={() => void start()}
      />
      <Text style={[typography.small, { color: colors.text2 }]}>
        {t(plan === 'year' ? 'premium.offer.termsYear' : 'premium.offer.termsMonth')}
      </Text>

      <View accessibilityRole="summary" style={{ gap: space[1] }}>
        <Text style={[typography.h3, { color: colors.text }]}>{t('premium.table.title')}</Text>
        {TABLE_ROWS.map((row) => (
          <View
            key={row}
            accessible
            accessibilityLabel={`${t(`premium.table.rows.${row}`)}: ${t('premium.table.free')} ${cellText(TABLE_CELLS[row][0], t)}, ${t('premium.table.premium')} ${cellText(TABLE_CELLS[row][1], t)}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2],
              paddingVertical: space[2],
              borderTopWidth: 1,
              borderTopColor: colors.line,
            }}
          >
            <Text style={[typography.small, { color: colors.text, flex: 1 }]}>
              {t(`premium.table.rows.${row}`)}
            </Text>
            <Text
              style={[typography.small, { color: colors.text2, width: 84, textAlign: 'center' }]}
            >
              {cellText(TABLE_CELLS[row][0], t)}
            </Text>
            <Text
              style={[
                typography.small,
                {
                  color: colors.text,
                  width: 84,
                  textAlign: 'center',
                  backgroundColor: colors.brandTint,
                  borderRadius: radius.input / 2,
                  paddingVertical: 2,
                },
              ]}
            >
              {cellText(TABLE_CELLS[row][1], t)}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

function Active({
  subscription,
  scheme,
}: {
  subscription: SubscriptionView;
  scheme: 'light' | 'dark';
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [cancel, cancelling] = useCancelSubscriptionMutation();
  const end = subscription.currentPeriodEnd ? formatDay(subscription.currentPeriodEnd) : '';
  const rows: [string, string][] = [
    [t('premium.active.plan'), t(`premium.active.planName.${subscription.plan ?? 'month'}`)],
    [subscription.autoRenew ? t('premium.active.next') : t('premium.active.until'), end],
    ...(subscription.cardLast4
      ? ([
          [
            t('premium.active.card'),
            t('premium.active.cardValue', { last4: subscription.cardLast4 }),
          ],
        ] as [string, string][])
      : []),
  ];
  return (
    <View
      style={{
        alignItems: 'center',
        gap: space[3],
        padding: space[4],
        borderRadius: radius.card,
        borderWidth: shashka.borderLarge,
        borderColor: colors.brand,
        backgroundColor: colors.surface,
      }}
    >
      <Mascot mood="proud" size={140} accessory="crown" dark={scheme === 'dark'} />
      <Text
        accessibilityRole="header"
        style={[typography.h1, { color: colors.text, textAlign: 'center' }]}
      >
        {t('premium.active.title')}
      </Text>
      {subscription.status === 'past_due' && <Banner>{t('premium.active.pastDue')}</Banner>}
      <View style={{ alignSelf: 'stretch', gap: space[2] }}>
        {rows.map(([name, value]) => (
          <View
            key={name}
            accessible
            accessibilityLabel={`${name}: ${value}`}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text style={[typography.small, { color: colors.text2 }]}>{name}</Text>
            <Text style={[typography.small, { color: colors.text }]}>{value}</Text>
          </View>
        ))}
      </View>
      {cancelling.isError && <Banner>{t('premium.active.error')}</Banner>}
      {subscription.autoRenew && (
        <Button
          variant="danger"
          disabled={cancelling.isLoading}
          label={cancelling.isLoading ? t('premium.active.cancelling') : t('premium.active.cancel')}
          onPress={() => void cancel()}
        />
      )}
    </View>
  );
}

function Canceled({
  subscription,
  scheme,
}: {
  subscription: SubscriptionView;
  scheme: 'light' | 'dark';
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [resume, resuming] = useResumeSubscriptionMutation();
  const date = subscription.currentPeriodEnd ? formatDay(subscription.currentPeriodEnd) : '';
  return (
    <View style={{ alignItems: 'center', gap: space[3] }}>
      <Mascot mood="sleepy" size={120} dark={scheme === 'dark'} />
      <Text
        accessibilityRole="header"
        style={[typography.h1, { color: colors.text, textAlign: 'center' }]}
      >
        {t('premium.canceled.title')}
      </Text>
      <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
        {t('premium.canceled.text', { date })}
      </Text>
      <Text
        style={[
          typography.small,
          {
            color: colors.skyText,
            backgroundColor: colors.skyTint,
            padding: space[3],
            borderRadius: radius.card,
            alignSelf: 'stretch',
          },
        ]}
      >
        {t('premium.canceled.info')}
      </Text>
      {resuming.isError && <Banner>{t('premium.active.error')}</Banner>}
      <Button
        large
        variant="premium"
        disabled={resuming.isLoading}
        label={resuming.isLoading ? t('premium.canceled.resuming') : t('premium.canceled.resume')}
        onPress={() => void resume()}
      />
    </View>
  );
}
