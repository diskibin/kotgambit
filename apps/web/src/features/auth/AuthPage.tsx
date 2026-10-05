import {
  apiErrorOf,
  checkEmail,
  checkPassword,
  OAuthErrorSchema,
  OAuthProviderSchema,
  type EmailProblem,
  type PasswordProblem,
} from '@kotgambit/contracts';
import type { Mood } from '@kotgambit/mascot';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useLinkIdentityMutation, useLoginMutation, useRegisterMutation } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Spinner } from '../../shared/ui/Spinner';
import { Tabs } from '../../shared/ui/Tabs';
import { PasswordField } from '../../shared/ui/PasswordField';
import { TextField } from '../../shared/ui/TextField';
import { AuthShell } from './AuthShell';
import { SocialSignIn } from './SocialSignIn';

export type AuthMode = 'login' | 'register';

const TABS = ['login', 'register'] as const;
const MASCOT_SIZE = 112;
const CARD_WIDTH = 480;

function moodFor(
  loading: boolean,
  email: EmailProblem | null,
  password: PasswordProblem | null,
): Mood {
  if (loading) return 'thinking';
  if (email === 'taken') return 'hint';
  if (email === 'noAt' || email === 'invalid') return 'thinking';
  if (password === 'wrong') return 'oops';
  return 'wave';
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useAppSelector((state) => state.auth.status);
  const [login, loginState] = useLoginMutation();
  const [register, registerState] = useRegisterMutation();
  const [linkIdentity] = useLinkIdentityMutation();
  // The server sends the browser back here after a sign-in with a provider, the outcome is in the address
  const [params] = useSearchParams();
  const oauthError = OAuthErrorSchema.safeParse(params.get('oauth_error'));
  const linkTicket = params.get('link');
  const linkProvider = OAuthProviderSchema.safeParse(params.get('provider'));

  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [emailProblem, setEmailProblem] = useState<EmailProblem | null>(null);
  const [passwordProblem, setPasswordProblem] = useState<PasswordProblem | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const loading = loginState.isLoading || registerState.isLoading;
  const isLogin = mode === 'login';

  if (status === 'authenticated') return <Navigate to="/learn" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
      // The session starts in the store, which redirects this page
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.code === 'auth.invalid_credentials') setPasswordProblem('wrong');
      else if (apiError?.code === 'auth.email_taken') setEmailProblem('taken');
      else setServerMessage(apiError?.message ?? t('auth.networkError'));
    }
  }

  const emailMessage = emailProblem && (
    <>
      {t(`auth.email.${emailProblem}`)}
      {emailProblem === 'taken' && (
        <>
          {' '}
          <Link
            to="/login"
            state={{ email }}
            className="font-extrabold text-brand-text underline-offset-2 hover:underline"
          >
            {t('auth.email.takenAction')}
          </Link>
        </>
      )}
    </>
  );

  const submitLabel = loading
    ? t(isLogin ? 'auth.submit.loadingLogin' : 'auth.submit.loadingRegister')
    : t(isLogin ? 'auth.submit.login' : 'auth.submit.register');

  return (
    <AuthShell
      mood={moodFor(loading, emailProblem, passwordProblem)}
      catSize={MASCOT_SIZE}
      cardWidth={CARD_WIDTH}
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Tabs
          label={t('auth.tablistLabel')}
          tabs={TABS.map((id) => ({ id, label: t(`auth.tabs.${id}`) }))}
          value={mode}
          onChange={(next) => void navigate(`/${next}`, { state: { email } })}
        />

        {passwordProblem === 'wrong' && (
          <Banner>
            {t('auth.wrong.before')}
            <Link to="/reset" className="font-extrabold underline">
              {t('auth.wrong.link')}
            </Link>
            {t('auth.wrong.after')}
          </Banner>
        )}
        {oauthError.success && <Banner>{t(`auth.social.errors.${oauthError.data}`)}</Banner>}
        {linkTicket && linkProvider.success && (
          <Banner>
            {t('auth.social.link', { name: t(`auth.social.names.${linkProvider.data}`) })}
          </Banner>
        )}
        {serverMessage && <Banner>{serverMessage}</Banner>}

        <TextField
          label={t('auth.email.label')}
          type="email"
          autoComplete="email"
          placeholder={t('auth.email.placeholder')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
          error={emailMessage}
        />

        <PasswordField
          label={t('auth.password.label')}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
              <Link
                to="/reset"
                className="flex min-h-8 items-center text-[14px] font-extrabold text-brand-text"
              >
                {t('auth.forgot')}
              </Link>
            ) : undefined
          }
        />

        <Button type="submit" large fullWidth disabled={loading} aria-busy={loading}>
          {loading && <Spinner />}
          {submitLabel}
        </Button>

        <SocialSignIn />

        <p className="m-0 text-center text-[13px] leading-[18px] font-semibold text-text-2">
          {t('auth.terms')}
        </p>
      </form>
    </AuthShell>
  );
}
