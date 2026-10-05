import {
  apiErrorOf,
  checkEmail,
  checkPassword,
  type EmailProblem,
  type OAuthProviderId,
  type PasswordProblem,
} from '@kotgambit/contracts';
import type { Mood } from '@kotgambit/mascot';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_URL,
  useExchangeOAuthCodeMutation,
  useLinkIdentityMutation,
  useLoginMutation,
  useOauthProvidersQuery,
  useRegisterMutation,
} from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { SpeechBubble } from '../../shared/ui/SpeechBubble';
import { Spinner } from '../../shared/ui/Spinner';
import { Tabs } from '../../shared/ui/Tabs';
import { TextField } from '../../shared/ui/TextField';
import { useTheme } from '../../theme/ThemeProvider';
import { screenPadding, size, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { parseOAuthDeepLink } from './oauthDeepLink';

type Mode = 'login' | 'register';

const TABS = ['login', 'register'] as const;
const MASCOT_SIZE = 72;
const RETURN_MASCOT_SIZE = 150;

// The address that opened the app stays the same while the process lives, so a screen that is built again
// must not use the one-time code in it a second time
const handledLinks = new Set<string>();

interface Status {
  loading: boolean;
  mode: Mode;
  email: EmailProblem | null;
  password: PasswordProblem | null;
}

function moodOf({ loading, email, password }: Status): Mood {
  if (loading) return 'thinking';
  if (email === 'taken') return 'hint';
  if (email === 'noAt' || email === 'invalid') return 'thinking';
  if (password === 'wrong') return 'oops';
  return 'wave';
}

function bubbleKey({ loading, mode, email, password }: Status): string {
  if (loading) return 'loading';
  if (email === 'taken') return 'taken';
  if (email === 'noAt' || email === 'invalid') return 'emailProblem';
  if (password === 'wrong') return 'wrong';
  return mode === 'register' ? 'register' : 'empty';
}

export function AuthScreen({
  onForgot,
  initialMode = 'login',
}: {
  onForgot: () => void;
  initialMode?: Mode;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [login, loginState] = useLoginMutation();
  const [register, registerState] = useRegisterMutation();
  const [exchange] = useExchangeOAuthCodeMutation();
  const [linkIdentity] = useLinkIdentityMutation();
  const providers = useOauthProvidersQuery().data?.providers ?? [];

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailProblem, setEmailProblem] = useState<EmailProblem | null>(null);
  const [passwordProblem, setPasswordProblem] = useState<PasswordProblem | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  // The sign-in with a provider happens in the system browser, the app is told how it went by a deep link
  const [pendingProvider, setPendingProvider] = useState<OAuthProviderId | null>(null);
  const [returning, setReturning] = useState(false);
  const [linkTicket, setLinkTicket] = useState<string | null>(null);

  useEffect(() => {
    async function handle(url: string) {
      const link = parseOAuthDeepLink(url);
      if (!link || handledLinks.has(url)) return;
      handledLinks.add(url);
      if (link.kind === 'code') {
        setReturning(true);
        try {
          // The session starts in the store, which swaps this screen for the app
          await exchange({ code: link.code }).unwrap();
        } catch {
          setReturning(false);
          setServerMessage(t('auth.social.errors.failed'));
        }
      } else if (link.kind === 'link') {
        setLinkTicket(link.ticket);
        setServerMessage(
          link.provider
            ? t('auth.social.link', { name: t(`auth.social.names.${link.provider}`) })
            : null,
        );
      } else {
        setServerMessage(t(`auth.social.errors.${link.error}`));
      }
    }
    const subscription = Linking.addEventListener('url', ({ url }) => void handle(url));
    void Linking.getInitialURL().then((url) => (url ? handle(url) : undefined));
    return () => subscription.remove();
  }, [exchange, t]);

  const loading = loginState.isLoading || registerState.isLoading;
  const isLogin = mode === 'login';
  const status: Status = { loading, mode, email: emailProblem, password: passwordProblem };

  async function submit() {
    const nextEmail = checkEmail(email.trim());
    const nextPassword = checkPassword(password, mode);
    setEmailProblem(nextEmail);
    setPasswordProblem(nextPassword);
    setServerMessage(null);
    if (nextEmail || nextPassword) return;

    try {
      await (isLogin ? login({ email, password }) : register({ email, password })).unwrap();
      // The learner has proven the account is theirs, so the provider account can be tied to it now.
      // If it does not work out, the sign-in itself still did
      if (isLogin && linkTicket) await linkIdentity({ ticket: linkTicket });
      // The session starts in the store, which swaps this screen for the app
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.code === 'auth.invalid_credentials') setPasswordProblem('wrong');
      else if (apiError?.code === 'auth.email_taken') setEmailProblem('taken');
      else setServerMessage(apiError?.message ?? t('auth.networkError'));
    }
  }

  function openProvider(id: OAuthProviderId) {
    setPendingProvider(id);
    setServerMessage(null);
    Linking.openURL(`${API_URL}/auth/oauth/${id}/start?client=mobile`).catch(() =>
      setServerMessage(t('auth.social.errors.failed')),
    );
  }

  function switchTo(next: Mode) {
    setMode(next);
    setEmailProblem(null);
    setPasswordProblem(null);
    setServerMessage(null);
  }

  const emailMessage = emailProblem && (
    <>
      {t(`auth.email.${emailProblem}`)}
      {emailProblem === 'taken' && (
        <Text
          accessibilityRole="link"
          onPress={() => switchTo('login')}
          style={{ color: colors.brandText, fontFamily: 'Onest-ExtraBold' }}
        >
          {' '}
          {t('auth.email.takenAction')}
        </Text>
      )}
    </>
  );

  const submitLabel = loading
    ? t(isLogin ? 'auth.submit.loadingLogin' : 'auth.submit.loadingRegister')
    : t(isLogin ? 'auth.submit.login' : 'auth.submit.register');

  if (returning) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: screenPadding,
          gap: space[3],
        }}
      >
        <Mascot mood="thinking" size={RETURN_MASCOT_SIZE} dark={scheme === 'dark'} animate />
        <Text
          accessibilityRole="header"
          style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
        >
          {t('auth.social.browser.title')}
        </Text>
        <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
          {pendingProvider
            ? t('auth.social.browser.text', { name: t(`auth.social.names.${pendingProvider}`) })
            : t('auth.social.browser.textPlain')}
        </Text>
        <Spinner color={colors.brand} />
        {pendingProvider && (
          <Button
            variant="text"
            label={t('auth.social.browser.again')}
            onPress={() => openProvider(pendingProvider)}
          />
        )}
      </View>
    );
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Mascot mood={moodOf(status)} size={MASCOT_SIZE} dark={scheme === 'dark'} animate />
        <SpeechBubble text={t(`auth.bubble.${bubbleKey(status)}`)} />
      </View>

      <Tabs
        label={t('auth.tablistLabel')}
        tabs={TABS.map((id) => ({ id, label: t(`auth.tabs.${id}`) }))}
        value={mode}
        onChange={switchTo}
      />

      {passwordProblem === 'wrong' && (
        <Banner>
          {t('auth.wrong.before')}
          <Text
            accessibilityRole="link"
            onPress={onForgot}
            style={{ fontFamily: 'Onest-ExtraBold', textDecorationLine: 'underline' }}
          >
            {t('auth.wrong.link')}
          </Text>
          {t('auth.wrong.after')}
        </Banner>
      )}
      {serverMessage && <Banner>{serverMessage}</Banner>}

      <TextField
        label={t('auth.email.label')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.email.placeholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
        disabled={loading}
        error={emailMessage}
      />

      <TextField
        label={t('auth.password.label')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        disabled={loading}
        invalid={passwordProblem === 'wrong'}
        error={
          passwordProblem === 'required' || passwordProblem === 'tooShort'
            ? t(`auth.password.${passwordProblem}`)
            : undefined
        }
        hint={isLogin ? undefined : t('auth.password.hint')}
        labelAside={
          isLogin ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('auth.forgot')}
              onPress={onForgot}
              style={{ minHeight: size.tapMin, justifyContent: 'center' }}
            >
              <Text
                style={{ fontFamily: 'Onest-ExtraBold', fontSize: 14, color: colors.brandText }}
              >
                {t('auth.forgot')}
              </Text>
            </Pressable>
          ) : undefined
        }
        endAdornment={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(showPassword ? 'auth.password.hide' : 'auth.password.show')}
            accessibilityState={{ selected: showPassword }}
            onPress={() => setShowPassword((shown) => !shown)}
            style={{
              width: size.tapMin,
              height: size.tapMin,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                stroke={colors.text2}
                strokeWidth={2.4}
                strokeLinejoin="round"
              />
              <Circle cx="12" cy="12" r="3" stroke={colors.text2} strokeWidth={2.4} />
              {showPassword && (
                <Path
                  d="M4 4l16 16"
                  stroke={colors.text2}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              )}
            </Svg>
          </Pressable>
        }
      />

      <Button
        large
        label={submitLabel}
        onPress={() => void submit()}
        disabled={loading}
        busy={loading}
        icon={loading ? <Spinner color={colors.onBrand} /> : undefined}
      />

      {providers.length > 0 && (
        <>
          <View
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
          >
            <View style={{ flex: 1, height: 2, backgroundColor: colors.line }} />
            <Text style={[typography.small, { color: colors.text2 }]}>{t('auth.social.or')}</Text>
            <View style={{ flex: 1, height: 2, backgroundColor: colors.line }} />
          </View>
          {providers.map((id) => (
            <Button
              key={id}
              variant="secondary"
              label={t('auth.social.signInWith', { name: t(`auth.social.names.${id}`) })}
              onPress={() => openProvider(id)}
            />
          ))}
        </>
      )}

      <Text style={[typography.caption, { color: colors.text2, textAlign: 'center' }]}>
        {t('auth.terms')}
      </Text>
    </ScrollView>
  );
}
