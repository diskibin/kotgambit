import { apiErrorOf, checkEmail, checkPassword } from '@kotgambit/contracts';
import type { Mood } from '@kotgambit/mascot';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForgotPasswordMutation, useResetPasswordMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Chip } from '../../shared/ui/Chip';
import { PasswordField } from '../../shared/ui/PasswordField';
import { Spinner } from '../../shared/ui/Spinner';
import { StrengthMeter } from '../../shared/ui/StrengthMeter';
import { TextField } from '../../shared/ui/TextField';
import { AuthShell } from './AuthShell';
import { passwordStrength } from './passwordStrength';

type Step = 'request' | 'sent' | 'newPassword' | 'success' | 'expired';

const MOODS: Record<Step, Mood> = {
  request: 'thinking',
  sent: 'happy',
  newPassword: 'idle',
  success: 'cheer',
  expired: 'oops',
};

const CARD_WIDTH = 460;
const CAT_SIZE = 150;
const RESEND_SECONDS = 45;
const SECONDS_IN_MINUTE = 60;

function formatTime(seconds: number): string {
  const rest = String(seconds % SECONDS_IN_MINUTE).padStart(2, '0');
  return `${Math.floor(seconds / SECONDS_IN_MINUTE)}:${rest}`;
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="m-0 font-heading text-[22px] leading-[30px] font-bold">{title}</h1>
      <p className="m-0 text-[16px] leading-6 font-medium text-text-2">{text}</p>
    </div>
  );
}

function BackToLogin() {
  const { t } = useTranslation();
  return (
    <Link
      to="/login"
      className="flex min-h-11 items-center justify-center font-extrabold text-brand-text"
    >
      {t('recover.backToLogin')}
    </Link>
  );
}

/** Asks for the address and sends the reset link; the sent card also lets the user ask again after a pause. */
function RequestSteps({
  onSent,
  sentTo,
}: {
  onSent: (email: string) => void;
  sentTo: string | null;
}) {
  const { t } = useTranslation();
  const [forgot, { isLoading }] = useForgotPasswordMutation();
  const [email, setEmail] = useState(sentTo ?? '');
  const [problem, setProblem] = useState<'noAt' | 'invalid' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (sentTo === null || wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [sentTo, wait]);

  async function send(address: string) {
    setMessage(null);
    const result = await forgot({ email: address });
    if ('error' in result) {
      setMessage(apiErrorOf(result.error)?.message ?? t('auth.networkError'));
      return false;
    }
    return true;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = checkEmail(email.trim());
    setProblem(found === 'noAt' || found === 'invalid' ? found : null);
    if (found) return;
    if (await send(email)) {
      setWait(RESEND_SECONDS);
      onSent(email);
    }
  }

  if (sentTo !== null) {
    return (
      <>
        <Heading title={t('recover.sent.title')} text={t('recover.sent.text', { email: sentTo })} />
        {message && <Banner>{message}</Banner>}
        <p className="m-0 rounded-card border-2 border-sky-border bg-sky-tint px-3.5 py-3 text-[15px] leading-[22px] font-bold text-sky-text">
          {t('recover.sent.spamNote')}
        </p>
        <Button
          variant="secondary"
          large
          fullWidth
          disabled={wait > 0 || isLoading}
          onClick={async () => {
            if (await send(sentTo)) setWait(RESEND_SECONDS);
          }}
        >
          {wait > 0
            ? t('recover.sent.resendWait', { time: formatTime(wait) })
            : t('recover.sent.resend')}
        </Button>
        <BackToLogin />
      </>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Heading title={t('recover.request.title')} text={t('recover.request.text')} />
      {message && <Banner>{message}</Banner>}
      <TextField
        label={t('auth.email.label')}
        type="email"
        autoComplete="email"
        placeholder={t('auth.email.placeholder')}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={isLoading}
        error={problem ? t(`auth.email.${problem}`) : undefined}
      />
      <Button type="submit" large fullWidth disabled={isLoading} aria-busy={isLoading}>
        {isLoading && <Spinner />}
        {isLoading ? t('recover.request.sending') : t('recover.request.submit')}
      </Button>
      <BackToLogin />
    </form>
  );
}

function NewPasswordStep({
  token,
  onDone,
  onExpired,
}: {
  token: string;
  onDone: () => void;
  onExpired: () => void;
}) {
  const { t } = useTranslation();
  const [reset, { isLoading }] = useResetPasswordMutation();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [problem, setProblem] = useState<'required' | 'tooShort' | 'mismatch' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const strength = passwordStrength(password);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const weak = checkPassword(password, 'register');
    const next =
      weak === 'required' || weak === 'tooShort' ? weak : password !== repeat ? 'mismatch' : null;
    setProblem(next);
    if (next) return;

    const result = await reset({ token, password });
    if (!('error' in result)) return onDone();
    const apiError = apiErrorOf(result.error);
    if (apiError?.code === 'auth.link_expired') return onExpired();
    setMessage(apiError?.message ?? t('auth.networkError'));
  }

  const hint =
    password.length === 0
      ? undefined
      : `${t(`recover.newPassword.strength.${strength.label}`)}: ${t('recover.newPassword.strength.length', { count: strength.length })}${strength.hasDigits ? `, ${t('recover.newPassword.strength.digits')}` : ''}`;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Heading title={t('recover.newPassword.title')} text={t('recover.newPassword.text')} />
      {message && <Banner>{message}</Banner>}
      <div className="flex flex-col gap-2">
        <PasswordField
          label={t('recover.newPassword.password')}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
          error={
            problem === 'required' || problem === 'tooShort'
              ? t(`auth.password.${problem}`)
              : undefined
          }
          hint={hint}
        />
        <StrengthMeter filled={strength.filled} />
      </div>
      <PasswordField
        label={t('recover.newPassword.repeat')}
        autoComplete="new-password"
        value={repeat}
        onChange={(event) => setRepeat(event.target.value)}
        disabled={isLoading}
        error={problem === 'mismatch' ? t('recover.newPassword.mismatch') : undefined}
      />
      <Button type="submit" large fullWidth disabled={isLoading} aria-busy={isLoading}>
        {isLoading && <Spinner />}
        {isLoading ? t('recover.newPassword.saving') : t('recover.newPassword.submit')}
      </Button>
    </form>
  );
}

export function RecoverPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const token = params.get('token');
  const [step, setStep] = useState<Step>(token ? 'newPassword' : 'request');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const effective: Step = step === 'request' && sentTo !== null ? 'sent' : step;

  return (
    <AuthShell mood={MOODS[effective]} catSize={CAT_SIZE} cardWidth={CARD_WIDTH}>
      {(effective === 'request' || effective === 'sent') && (
        <RequestSteps sentTo={sentTo} onSent={setSentTo} />
      )}
      {effective === 'newPassword' && token && (
        <NewPasswordStep
          token={token}
          onDone={() => setStep('success')}
          onExpired={() => setStep('expired')}
        />
      )}
      {effective === 'success' && (
        <>
          <Heading title={t('recover.success.title')} text={t('recover.success.text')} />
          <Chip tone="mint">{t('recover.success.chip')}</Chip>
          <Button variant="success" large fullWidth onClick={() => void navigate('/login')}>
            {t('recover.success.action')}
          </Button>
        </>
      )}
      {effective === 'expired' && (
        <>
          <Heading title={t('recover.expired.title')} text={t('recover.expired.text')} />
          <Chip tone="coral">{t('recover.expired.chip')}</Chip>
          <Button
            large
            fullWidth
            onClick={() => {
              // The dead link is dropped from the address so that a reload starts from the form
              setParams({}, { replace: true });
              setSentTo(null);
              setStep('request');
            }}
          >
            {t('recover.expired.action')}
          </Button>
          <BackToLogin />
        </>
      )}
    </AuthShell>
  );
}
