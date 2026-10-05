import { apiErrorOf } from '@kotgambit/contracts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Text, View } from 'react-native';
import { useMeQuery, useResendVerificationMutation } from '../../app/api';
import { Button } from '../../shared/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/theme';

const RESEND_SECONDS = 45;
const SECONDS_IN_MINUTE = 60;

function clock(seconds: number): string {
  return `${Math.floor(seconds / SECONDS_IN_MINUTE)}:${String(seconds % SECONDS_IN_MINUTE).padStart(2, '0')}`;
}

/**
 * Asks a learner whose address is not confirmed to open the link from the email, and sends the email again on
 * request. It goes away by itself once the address is confirmed: the app looks again when it comes back from the mail app.
 */
export function VerifyEmailReminder() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const me = useMeQuery();
  const [resend, sending] = useResendVerificationMutation();
  // The first email went out with the sign-up, so the button starts already counting down
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const { refetch } = me;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  if (!me.data || me.data.emailVerified) return null;

  async function send() {
    setFailed(null);
    try {
      await resend().unwrap();
      setSent(true);
      setWait(RESEND_SECONDS);
    } catch (error) {
      setFailed(apiErrorOf(error)?.message ?? t('verify.reminder.error'));
    }
  }

  return (
    <View
      accessibilityLabel={t('verify.reminder.title')}
      style={{
        marginHorizontal: space[3],
        marginBottom: space[2],
        gap: space[2],
        padding: space[3],
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: colors.skyBorder,
        backgroundColor: colors.skyTint,
      }}
    >
      <Text accessibilityRole="header" style={[typography.h3, { color: colors.skyText }]}>
        {t('verify.reminder.title')}
      </Text>
      <Text style={[typography.small, { color: colors.skyText }]}>
        {t('verify.reminder.text', { email: me.data.email })}
      </Text>
      {sent && (
        <Text style={[typography.caption, { color: colors.skyText }]}>
          {t('verify.reminder.sent')}
        </Text>
      )}
      {failed && (
        <Text accessibilityRole="alert" style={[typography.caption, { color: colors.skyText }]}>
          {failed}
        </Text>
      )}
      <Button
        variant="secondary"
        disabled={wait > 0 || sending.isLoading}
        label={
          wait > 0
            ? t('verify.reminder.resendWait', { time: clock(wait) })
            : t('verify.reminder.resend')
        }
        onPress={() => void send()}
      />
    </View>
  );
}
