import { apiErrorOf } from '@kotgambit/contracts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeQuery, useResendVerificationMutation } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { formatClock } from '../../shared/formatClock';
import { Button } from '../../shared/ui/Button';

const RESEND_SECONDS = 45;

/**
 * Asks a signed-in learner whose address is not confirmed to open the link from the email, and sends the
 * email again on request. It disappears by itself once the address is confirmed, even in another tab.
 */
export function VerifyEmailReminder() {
  const { t } = useTranslation();
  const signedIn = useAppSelector((state) => state.auth.status === 'authenticated');
  const me = useMeQuery(undefined, { skip: !signedIn });
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

  // The link is opened in another tab or on another device: look again when the learner comes back here
  const { refetch } = me;
  useEffect(() => {
    if (!signedIn) return;
    const look = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', look);
    window.addEventListener('focus', look);
    return () => {
      document.removeEventListener('visibilitychange', look);
      window.removeEventListener('focus', look);
    };
  }, [signedIn, refetch]);

  if (!me.data || me.data.emailVerified) return null;

  async function send() {
    setFailed(null);
    const result = await resend();
    if ('error' in result) {
      setFailed(apiErrorOf(result.error)?.message ?? t('verify.reminder.error'));
      return;
    }
    setSent(true);
    setWait(RESEND_SECONDS);
  }

  return (
    <section
      aria-label={t('verify.reminder.title')}
      className="flex flex-col gap-3 rounded-card border-2 border-sky-border bg-sky-tint p-4 text-sky-text"
    >
      <h2 className="m-0 font-heading text-[18px] font-bold">{t('verify.reminder.title')}</h2>
      <p className="m-0 text-[15px] leading-[22px] font-bold">
        {t('verify.reminder.text', { email: me.data.email })}
      </p>
      {sent && <p className="m-0 text-[14px] font-semibold">{t('verify.reminder.sent')}</p>}
      {failed && (
        <p role="alert" className="m-0 text-[14px] font-semibold">
          {failed}
        </p>
      )}
      <Button
        variant="secondary"
        className="self-start"
        disabled={wait > 0 || sending.isLoading}
        onClick={() => void send()}
      >
        {wait > 0
          ? t('verify.reminder.resendWait', { time: formatClock(wait) })
          : t('verify.reminder.resend')}
      </Button>
    </section>
  );
}
