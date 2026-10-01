import { apiErrorOf, checkEmail } from '@kotgambit/contracts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForgotPasswordMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Spinner } from '../../shared/ui/Spinner';
import { TextField } from '../../shared/ui/TextField';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

const CAT_SIZE = 140;
const RESEND_SECONDS = 45;
const SECONDS_IN_MINUTE = 60;

function formatTime(seconds: number): string {
  const rest = String(seconds % SECONDS_IN_MINUTE).padStart(2, '0');
  return `${Math.floor(seconds / SECONDS_IN_MINUTE)}:${rest}`;
}

/**
 * Asks for the address and sends the reset link. The link itself opens in the browser, where the new
 * password is chosen: app links need a verified domain, which is not there yet.
 */
export function RecoverScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [forgot, { isLoading }] = useForgotPasswordMutation();

  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<'noAt' | 'invalid' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (sentTo === null || wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [sentTo, wait]);

  async function send(address: string): Promise<boolean> {
    setMessage(null);
    const result = await forgot({ email: address });
    if ('error' in result) {
      setMessage(apiErrorOf(result.error)?.message ?? t('auth.networkError'));
      return false;
    }
    setWait(RESEND_SECONDS);
    return true;
  }

  async function submit() {
    const found = checkEmail(email.trim());
    setProblem(found === 'noAt' || found === 'invalid' ? found : null);
    if (found) return;
    if (await send(email)) setSentTo(email);
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: screenPadding,
        paddingTop: insets.top + screenPadding,
        paddingBottom: insets.bottom + screenPadding,
        gap: space[3],
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Mascot
          mood={sentTo !== null ? 'happy' : 'hint'}
          size={CAT_SIZE}
          dark={scheme === 'dark'}
          animate
        />
      </View>
      <Text style={[typography.h1, { color: colors.text, textAlign: 'center' }]}>
        {t(sentTo !== null ? 'recover.sent.title' : 'recover.request.title')}
      </Text>
      <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
        {sentTo !== null ? t('recover.sent.text', { email: sentTo }) : t('recover.request.text')}
      </Text>

      {message && <Banner>{message}</Banner>}

      {sentTo !== null ? (
        <>
          <View
            style={{
              padding: space[3],
              borderRadius: radius.card,
              borderWidth: 2,
              borderColor: colors.skyBorder,
              backgroundColor: colors.skyTint,
            }}
          >
            <Text style={[typography.small, { color: colors.skyText, fontFamily: 'Onest-Bold' }]}>
              {t('recover.sent.spamNote')}
            </Text>
          </View>
          <Button
            variant="secondary"
            large
            label={
              wait > 0
                ? t('recover.sent.resendWait', { time: formatTime(wait) })
                : t('recover.sent.resend')
            }
            disabled={wait > 0 || isLoading}
            onPress={() => void send(sentTo)}
          />
        </>
      ) : (
        <>
          <TextField
            label={t('auth.email.label')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email.placeholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            disabled={isLoading}
            error={problem ? t(`auth.email.${problem}`) : undefined}
          />
          <Button
            large
            label={isLoading ? t('recover.request.sending') : t('recover.request.submit')}
            onPress={() => void submit()}
            disabled={isLoading}
            busy={isLoading}
            icon={isLoading ? <Spinner color={colors.onBrand} /> : undefined}
          />
        </>
      )}

      <Button variant="text" label={t('recover.backToLogin')} onPress={onBack} />
    </ScrollView>
  );
}
