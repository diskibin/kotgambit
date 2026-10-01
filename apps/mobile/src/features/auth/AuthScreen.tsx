import {
  apiErrorOf,
  checkEmail,
  checkPassword,
  type EmailProblem,
  type PasswordProblem,
} from '@kotgambit/contracts';
import type { Mood } from '@kotgambit/mascot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLoginMutation, useRegisterMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { SpeechBubble } from '../../shared/ui/SpeechBubble';
import { Spinner } from '../../shared/ui/Spinner';
import { Tabs } from '../../shared/ui/Tabs';
import { TextField } from '../../shared/ui/TextField';
import { useTheme } from '../../theme/ThemeProvider';
import { screenPadding, size, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

type Mode = 'login' | 'register';

const TABS = ['login', 'register'] as const;
const MASCOT_SIZE = 72;

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

export function AuthScreen() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [login, loginState] = useLoginMutation();
  const [register, registerState] = useRegisterMutation();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailProblem, setEmailProblem] = useState<EmailProblem | null>(null);
  const [passwordProblem, setPasswordProblem] = useState<PasswordProblem | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

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
      // The session starts in the store, which swaps this screen for the app
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.code === 'auth.invalid_credentials') setPasswordProblem('wrong');
      else if (apiError?.code === 'auth.email_taken') setEmailProblem('taken');
      else setServerMessage(apiError?.message ?? t('auth.networkError'));
    }
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

      {passwordProblem === 'wrong' && <Banner>{t('auth.wrong')}</Banner>}
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

      <Text style={[typography.caption, { color: colors.text2, textAlign: 'center' }]}>
        {t('auth.terms')}
      </Text>
    </ScrollView>
  );
}
