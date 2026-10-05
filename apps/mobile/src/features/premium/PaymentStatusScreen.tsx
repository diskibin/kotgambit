import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, usePaymentQuery } from '../../app/api';
import { useAppDispatch } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

const POLL_MS = 2000;
const CAT = 160;

interface PaymentStatusScreenProps {
  paymentId: string;
  /** The payment went through (or the learner leaves): back to the app. */
  onDone: () => void;
  /** Another try at the plans. */
  onRetry: () => void;
}

/**
 * What became of the payment, as the server says. The server asked the provider; the app only shows it. The
 * learner may close this screen at any time: Premium switches on by itself once the provider confirms.
 */
export function PaymentStatusScreen({ paymentId, onDone, onRetry }: PaymentStatusScreenProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [interval, setIntervalMs] = useState(POLL_MS);
  const payment = usePaymentQuery(paymentId, { pollingInterval: interval });
  const status = payment.data?.status;
  const final = status === 'succeeded' || status === 'canceled';
  // The answer is final once the payment went through or was refused: no need to ask again
  if ((final ? 0 : POLL_MS) !== interval) setIntervalMs(final ? 0 : POLL_MS);

  // A paid subscription changes what every screen may show, so they are told to ask again
  useEffect(() => {
    if (status === 'succeeded') dispatch(api.util.invalidateTags(['Billing', 'Puzzles']));
  }, [status, dispatch]);

  const view =
    status === 'succeeded'
      ? {
          mood: 'cheer' as const,
          title: t('billing.paid.title'),
          text: t('billing.paid.textApp'),
          chip: t('billing.paid.chip'),
        }
      : status === 'canceled'
        ? {
            mood: 'oops' as const,
            title: t('billing.failed.title'),
            text: t('billing.failed.textApp'),
            chip: t('billing.failed.chip'),
          }
        : {
            mood: 'thinking' as const,
            title: t('billing.processing.title'),
            text: t('billing.processing.textApp'),
            chip: null,
          };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[3],
        padding: screenPadding,
        paddingTop: insets.top + screenPadding,
        paddingBottom: insets.bottom + screenPadding,
      }}
    >
      <View
        style={{
          width: 200,
          height: 200,
          borderRadius: 200,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: status === 'succeeded' ? colors.sunTint : colors.brandTint,
        }}
      >
        <Mascot mood={view.mood} size={CAT} dark={scheme === 'dark'} animate />
      </View>
      {view.chip && (
        <View
          style={{
            borderRadius: radius.pill,
            backgroundColor: status === 'succeeded' ? colors.sun : colors.coralTint,
            paddingHorizontal: space[3],
            paddingVertical: space[1],
          }}
        >
          <Text
            style={[
              typography.small,
              { color: status === 'succeeded' ? colors.onAccent : colors.coralText },
            ]}
          >
            {view.chip}
          </Text>
        </View>
      )}
      <Text
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
      >
        {view.title}
      </Text>
      <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
        {view.text}
      </Text>
      {payment.isError && <Banner>{t('billing.checkError')}</Banner>}

      {status === 'succeeded' && (
        <Button large variant="premium" label={t('billing.paid.great')} onPress={onDone} />
      )}
      {status === 'canceled' && (
        <>
          <Button large label={t('billing.failed.retry')} onPress={onRetry} />
          <Button variant="text" label={t('billing.failed.later')} onPress={onDone} />
        </>
      )}
      {!final && (
        <>
          <Button
            variant="secondary"
            label={t('billing.processing.refresh')}
            onPress={() => void payment.refetch()}
          />
          <Button variant="text" label={t('billing.failed.later')} onPress={onDone} />
        </>
      )}
    </ScrollView>
  );
}
