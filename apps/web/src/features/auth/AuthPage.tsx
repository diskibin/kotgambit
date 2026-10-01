import {
  apiErrorOf,
  checkEmail,
  checkPassword,
  type EmailProblem,
  type PasswordProblem,
} from '@kotgambit/contracts';
import type { Mood } from '@kotgambit/mascot';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useLoginMutation, useRegisterMutation } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Spinner } from '../../shared/ui/Spinner';
import { Tabs } from '../../shared/ui/Tabs';
import { TextField } from '../../shared/ui/TextField';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

export type AuthMode = 'login' | 'register';

const TABS = ['login', 'register'] as const;
const MASCOT_SIZE = 112;
// The cat stands on the card, so the card moves up under its paws
const CARD_OVERLAP = 'mb-[-30px]';

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

function Tiles({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute hidden grid-cols-5 grid-rows-5 tablet:grid ${className}`}
    >
      {Array.from({ length: 25 }, (_, index) => (
        <div key={index} className={`size-20 ${index % 2 === 0 ? 'bg-brand-tint' : ''}`} />
      ))}
    </div>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const scheme = useScheme();
  const status = useAppSelector((state) => state.auth.status);
  const [login, loginState] = useLoginMutation();
  const [register, registerState] = useRegisterMutation();

  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailProblem, setEmailProblem] = useState<EmailProblem | null>(null);
  const [passwordProblem, setPasswordProblem] = useState<PasswordProblem | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const loading = loginState.isLoading || registerState.isLoading;
  const isLogin = mode === 'login';

  if (status === 'authenticated') return <Navigate to="/" replace />;

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
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-bg text-text">
      <Tiles className="-bottom-10 -left-[60px] rotate-[8deg]" />
      <Tiles className="-right-[60px] -top-10 -rotate-[10deg]" />

      <header className="relative flex h-20 items-center self-stretch px-4 tablet:px-12">
        <Link to="/" className="flex items-center gap-2.5 font-heading text-[19px] font-bold">
          <Mascot mood="idle" size={44} dark={scheme === 'dark'} />
          {t('auth.logo')}
        </Link>
      </header>

      <main className="relative flex w-full flex-col items-center px-4 pr-6 pb-12">
        <div className={`relative ${CARD_OVERLAP}`}>
          <Mascot
            mood={moodFor(loading, emailProblem, passwordProblem)}
            size={MASCOT_SIZE}
            dark={scheme === 'dark'}
            animate
          />
        </div>
        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex w-full max-w-[480px] flex-col gap-3 rounded-[28px] border-3 border-edge bg-surface p-6 shadow-shashka-lg tablet:px-8"
        >
          <Tabs
            label={t('auth.tablistLabel')}
            tabs={TABS.map((id) => ({ id, label: t(`auth.tabs.${id}`) }))}
            value={mode}
            onChange={(next) => void navigate(`/${next}`, { state: { email } })}
          />

          {passwordProblem === 'wrong' && <Banner>{t('auth.wrong')}</Banner>}
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

          <TextField
            label={t('auth.password.label')}
            type={showPassword ? 'text' : 'password'}
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
            endAdornment={
              <button
                type="button"
                aria-label={t(showPassword ? 'auth.password.hide' : 'auth.password.show')}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((shown) => !shown)}
                className="flex size-11 items-center justify-center rounded-[10px] text-text-2"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="M4 4l16 16" />}
                </svg>
              </button>
            }
          />

          <Button type="submit" large fullWidth disabled={loading} aria-busy={loading}>
            {loading && <Spinner />}
            {submitLabel}
          </Button>

          <p className="m-0 text-center text-[13px] leading-[18px] font-semibold text-text-2">
            {t('auth.terms')}
          </p>
        </form>
      </main>
    </div>
  );
}
