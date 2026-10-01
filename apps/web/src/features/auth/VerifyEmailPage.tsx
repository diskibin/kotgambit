import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useVerifyEmailMutation } from '../../app/api';
import { Button } from '../../shared/ui/Button';
import { Chip } from '../../shared/ui/Chip';
import { Spinner } from '../../shared/ui/Spinner';
import { AuthShell } from './AuthShell';

type Outcome = 'checking' | 'done' | 'expired';

const CARD_WIDTH = 460;
const CAT_SIZE = 150;

/** Opened from the link in the verification email: spends the token and shows the result. */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [verify] = useVerifyEmailMutation();
  const [outcome, setOutcome] = useState<Outcome>(token ? 'checking' : 'expired');
  // A link works once, and React runs effects twice in development, so the call is guarded
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void verify({ token }).then((result) => setOutcome('error' in result ? 'expired' : 'done'));
  }, [token, verify]);

  return (
    <AuthShell
      mood={outcome === 'done' ? 'proud' : outcome === 'expired' ? 'oops' : 'thinking'}
      catSize={CAT_SIZE}
      cardWidth={CARD_WIDTH}
    >
      {outcome === 'checking' && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 py-4 text-[16px] font-bold"
        >
          <Spinner />
          {t('verify.checking')}
        </div>
      )}
      {outcome === 'done' && (
        <>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="m-0 font-heading text-[22px] leading-[30px] font-bold">
              {t('verify.done.title')}
            </h1>
            <p className="m-0 text-[16px] leading-6 font-medium text-text-2">
              {t('verify.done.text')}
            </p>
          </div>
          <Chip tone="mint">{t('verify.done.chip')}</Chip>
          <Button variant="success" large fullWidth onClick={() => void navigate('/')}>
            {t('verify.done.action')}
          </Button>
        </>
      )}
      {outcome === 'expired' && (
        <>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="m-0 font-heading text-[22px] leading-[30px] font-bold">
              {t('recover.expired.title')}
            </h1>
            <p className="m-0 text-[16px] leading-6 font-medium text-text-2">
              {t('recover.expired.text')}
            </p>
          </div>
          <Chip tone="coral">{t('recover.expired.chip')}</Chip>
          <Link
            to="/login"
            className="flex min-h-11 items-center justify-center font-extrabold text-brand-text"
          >
            {t('recover.backToLogin')}
          </Link>
        </>
      )}
    </AuthShell>
  );
}
