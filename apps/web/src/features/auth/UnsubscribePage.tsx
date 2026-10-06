import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useUnsubscribeRemindersMutation } from '../../app/api';
import { Button } from '../../shared/ui/Button';
import { Spinner } from '../../shared/ui/Spinner';
import { AuthShell } from './AuthShell';

type Outcome = 'checking' | 'done' | 'failed';

const CARD_WIDTH = 460;
const CAT_SIZE = 150;

/**
 * Opened from the link in a reminder: switches the reminders off, no sign-in needed. The call is made here and not
 * by the link itself, so that a mail scanner that opens every link of a letter does not unsubscribe anybody.
 */
export function UnsubscribePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [unsubscribe] = useUnsubscribeRemindersMutation();
  const [outcome, setOutcome] = useState<Outcome>(token ? 'checking' : 'failed');
  // React runs effects twice in development, one call is enough
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void unsubscribe({ token }).then((result) => setOutcome('error' in result ? 'failed' : 'done'));
  }, [token, unsubscribe]);

  return (
    <AuthShell
      mood={outcome === 'done' ? 'wave' : outcome === 'failed' ? 'oops' : 'thinking'}
      catSize={CAT_SIZE}
      cardWidth={CARD_WIDTH}
    >
      {outcome === 'checking' && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 py-4 text-[16px] font-bold"
        >
          <Spinner />
          {t('unsubscribe.checking')}
        </div>
      )}
      {outcome !== 'checking' && (
        <>
          <div className="flex flex-col gap-2 text-center">
            <h1 className="m-0 font-heading text-[22px] leading-[30px] font-bold">
              {t(`unsubscribe.${outcome}.title`)}
            </h1>
            <p className="m-0 text-[16px] leading-6 font-medium text-text-2">
              {t(`unsubscribe.${outcome}.text`)}
            </p>
          </div>
          <Button
            variant={outcome === 'done' ? 'success' : 'primary'}
            large
            fullWidth
            onClick={() => void navigate(outcome === 'done' ? '/learn' : '/settings')}
          >
            {t(`unsubscribe.${outcome}.action`)}
          </Button>
        </>
      )}
    </AuthShell>
  );
}
