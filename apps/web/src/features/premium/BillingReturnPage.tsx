import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { api, usePaymentQuery } from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Confetti } from '../lessons/Confetti';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

const POLL_MS = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where the learner lands after the payment page, on the web and, through the browser, from the app. Coming
 * back proves nothing: this page asks the server, which asked the provider, and shows what it says.
 */
export function BillingReturnPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const scheme = useScheme();
  const [params] = useSearchParams();
  const paymentId = params.get('paymentId') ?? '';
  const fromApp = params.get('client') === 'mobile';
  const auth = useAppSelector((state) => state.auth.status);
  const valid = UUID.test(paymentId);
  const [interval, setIntervalMs] = useState(POLL_MS);
  const payment = usePaymentQuery(paymentId, {
    skip: auth !== 'authenticated' || !valid,
    pollingInterval: interval,
  });
  const status = payment.data?.status;
  const final = status === 'succeeded' || status === 'canceled';
  // The server's answer is final once the payment went through or was refused: no need to ask again
  if ((final ? 0 : POLL_MS) !== interval) setIntervalMs(final ? 0 : POLL_MS);

  // A paid subscription changes what every screen may show, so they are told to ask again
  useEffect(() => {
    if (status === 'succeeded') dispatch(api.util.invalidateTags(['Billing', 'Puzzles']));
  }, [status, dispatch]);

  if (!valid) return <Navigate to="/premium" replace />;
  if (auth === 'anonymous') {
    // The browser opened from the app has no session: the app shows the result, this page only says so
    if (fromApp) {
      return (
        <Frame>
          <Mascot mood="happy" size={220} dark={scheme === 'dark'} />
          <h1 className="m-0 font-heading text-[32px] leading-10 font-bold">
            {t('billing.signedOut.title')}
          </h1>
          <p className="m-0 max-w-[560px] text-[19px] font-semibold text-text-2">
            {t('billing.signedOut.text')}
          </p>
        </Frame>
      );
    }
    return <Navigate to="/login" replace />;
  }

  if (status === 'succeeded') {
    return (
      <Frame>
        <Confetti />
        <Mascot mood="cheer" size={220} accessory="crown" dark={scheme === 'dark'} animate />
        <span className="rounded-pill bg-sun px-3.5 py-1 text-[14px] font-extrabold text-on-accent">
          {t('billing.paid.chip')}
        </span>
        <h1 className="m-0 font-heading text-[32px] leading-10 font-bold">
          {t('billing.paid.title')}
        </h1>
        <p className="m-0 max-w-[560px] text-[19px] font-semibold text-text-2">
          {t('billing.paid.text')}
        </p>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
          {(t('billing.paid.perks', { returnObjects: true }) as string[]).map((perk) => (
            <li
              key={perk}
              className="rounded-pill bg-mint-tint px-3.5 py-1 text-[14px] font-bold text-mint-text"
            >
              {perk}
            </li>
          ))}
        </ul>
        {fromApp && (
          <p className="m-0 text-[15px] font-semibold text-text-2">{t('billing.paid.backToApp')}</p>
        )}
        <Button variant="success" large onClick={() => void navigate('/learn')}>
          {t('billing.paid.lessons')}
        </Button>
      </Frame>
    );
  }

  if (status === 'canceled') {
    return (
      <Frame>
        <Mascot mood="oops" size={220} dark={scheme === 'dark'} />
        <span className="rounded-pill bg-coral-tint px-3.5 py-1 text-[14px] font-extrabold text-coral-text">
          {t('billing.failed.chip')}
        </span>
        <h1 className="m-0 font-heading text-[32px] leading-10 font-bold">
          {t('billing.failed.title')}
        </h1>
        <p className="m-0 max-w-[560px] text-[19px] font-semibold text-text-2">
          {t('billing.failed.text')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button large onClick={() => void navigate('/premium')}>
            {t('billing.failed.retry')}
          </Button>
          <Button variant="text" onClick={() => void navigate('/premium')}>
            {t('billing.failed.back')}
          </Button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <Mascot mood="thinking" size={220} dark={scheme === 'dark'} animate />
      <div role="status" className="flex flex-col items-center gap-4">
        <h1 className="m-0 font-heading text-[32px] leading-10 font-bold">
          {t('billing.processing.title')}
        </h1>
        <p className="m-0 max-w-[560px] text-[19px] font-semibold text-text-2">
          {t('billing.processing.text')}
        </p>
      </div>
      <div aria-hidden="true" className="h-2 w-64 overflow-hidden rounded-pill bg-surface-2">
        <div className="h-full w-1/3 animate-pulse rounded-pill bg-brand motion-reduce:animate-none" />
      </div>
      {payment.isError && <Banner>{t('billing.checkError')}</Banner>}
      {!final && (
        <Button variant="secondary" onClick={() => void payment.refetch()}>
          {t('billing.processing.refresh')}
        </Button>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="relative flex min-h-screen flex-col bg-bg text-text">
      <header className="flex min-h-20 items-center px-4 tablet:px-10">
        <span className="font-heading text-[20px] font-bold">{t('billing.brand')}</span>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        {children}
      </main>
    </div>
  );
}
