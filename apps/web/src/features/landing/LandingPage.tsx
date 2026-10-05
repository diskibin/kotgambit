import { createBoardState } from '@kotgambit/board-controller';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';
import { usePlansQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { Board } from '../board';
import { placementPieces } from '../board/placement';
import type { BoardArrow } from '../board/Arrows';
import { Mascot } from '../mascot/Mascot';
import { MiniBoard } from '../path/MiniBoard';
import { BotAvatar } from '../play/BotAvatar';
import { useScheme } from '../theme/useScheme';

const COOKIE_KEY = 'kotgambit.cookie';
const BOT_KINDS = ['mouse', 'hamster', 'fox', 'owl', 'wolf', 'bear'] as const;
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
const DASH = 'M7 12h10';
const NOOP = () => undefined;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const LINK_BUTTON =
  'flex items-center justify-center rounded-card border-2 border-edge shadow-shashka font-extrabold transition-[transform,box-shadow] duration-press ease-spring motion-reduce:transition-none active:translate-x-press active:translate-y-press active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0';

/** A board that only decorates the page: nothing on it can be moved, pressed or focused. */
function DemoBoard({
  fen,
  size,
  className = '',
  arrows,
  lastMove,
  hints,
}: {
  fen: string;
  size?: number;
  className?: string;
  arrows?: BoardArrow[];
  lastMove?: { from: string; to: string };
  hints?: string[];
}) {
  const state = useMemo(() => createBoardState({ fen: START, orientation: 'w' }), []);
  const pieces = useMemo(() => placementPieces(fen), [fen]);
  return (
    <div
      aria-hidden="true"
      inert
      className={className}
      {...(size ? { style: { width: size } } : {})}
    >
      <Board
        state={state}
        dispatch={NOOP}
        coords={false}
        disabled
        pieces={pieces}
        {...(arrows ? { arrows } : {})}
        lastMove={lastMove ?? null}
        {...(hints ? { hintSquares: hints } : {})}
        onSquarePress={NOOP}
      />
    </div>
  );
}

function Tick({ ok, tone }: { ok: boolean; tone: 'free' | 'premium' }) {
  const colors =
    tone === 'premium' || ok ? 'bg-mint text-on-accent' : 'bg-surface-2 text-text-muted';
  return (
    <span
      aria-hidden="true"
      className={`flex size-[26px] shrink-0 items-center justify-center rounded-full ${tone === 'free' && ok ? 'bg-mint-tint text-mint-text' : colors}`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ok ? CHECK : DASH} />
      </svg>
    </span>
  );
}

function FeatureCard({
  tone,
  title,
  text,
  children,
}: {
  tone: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <article
      className={`flex min-h-[360px] flex-col gap-3.5 rounded-[28px] border-2 border-edge p-7 shadow-shashka-lg ${tone}`}
    >
      <h3 className="m-0 font-heading text-[24px] leading-8 font-bold">{title}</h3>
      <p className="m-0 text-[18px] leading-7 font-semibold">{text}</p>
      <div className="mt-auto flex justify-center">{children}</div>
    </article>
  );
}

function Quote({
  tone,
  mood,
  text,
  caption,
  dark,
}: {
  tone: string;
  mood: 'happy' | 'oops' | 'hint';
  text: string;
  caption: string;
  dark: boolean;
}) {
  return (
    <figure className="m-0 flex flex-col items-center gap-1">
      <blockquote
        className={`relative m-0 rounded-reply border-2 px-5 py-4 text-center text-[18px] leading-7 font-extrabold ${tone}`}
      >
        «{text}»
        <span
          aria-hidden="true"
          className="absolute -bottom-[11px] left-[calc(50%-9px)] size-[18px] rotate-45 border-r-2 border-b-2 border-[inherit] bg-[inherit]"
        />
      </blockquote>
      <Mascot mood={mood} size={150} dark={dark} />
      <figcaption className="text-[14px] font-extrabold text-text-2">{caption}</figcaption>
    </figure>
  );
}

function Faq() {
  const { t } = useTranslation();
  const items = t('landing.faq.items', { returnObjects: true }) as { q: string; a: string }[];
  const [open, setOpen] = useState(0);
  return (
    <div className="flex w-full max-w-[820px] flex-col gap-3">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <div
            key={item.q}
            className="rounded-[20px] border-2 border-edge bg-surface shadow-shashka"
          >
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`faq-${index}`}
                onClick={() => setOpen(expanded ? -1 : index)}
                className="flex min-h-16 w-full items-center justify-between gap-4 rounded-[20px] px-5 py-4 text-left text-[18px] leading-[26px] font-extrabold"
              >
                {item.q}
                <span
                  aria-hidden="true"
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${expanded ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand-text'}`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <path d={expanded ? 'M6 12h12' : 'M12 6v12M6 12h12'} />
                  </svg>
                </span>
              </button>
            </h3>
            {expanded && (
              <p
                id={`faq-${index}`}
                className="m-0 px-5 pb-[18px] text-[16px] leading-6 font-semibold text-text-2"
              >
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CookieNotice({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const scheme = useScheme();
  return (
    <div
      role="region"
      aria-label={t('landing.cookie.label')}
      className="fixed inset-x-4 bottom-4 z-20 flex flex-col gap-3.5 rounded-panel border-2 border-line bg-surface px-5 py-4 tablet:items-center laptop:inset-x-[220px] tablet:flex-row"
    >
      <div className="flex flex-1 items-center gap-3">
        <Mascot mood="idle" size={56} dark={scheme === 'dark'} />
        <p className="m-0 text-[15px] leading-[22px] font-semibold">
          {t('landing.cookie.text')}{' '}
          <Link to="/privacy#cookies" className="font-extrabold">
            {t('landing.cookie.more')}
          </Link>
        </p>
      </div>
      <div className="flex gap-2.5">
        {/* Only what the site needs is kept, so both answers leave the same state: the choice is a notice, not a switch */}
        <button
          type="button"
          onClick={onClose}
          className={`${LINK_BUTTON} h-11 flex-1 bg-surface px-[18px] text-[16px] text-text`}
        >
          {t('landing.cookie.customize')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`${LINK_BUTTON} h-11 flex-1 bg-brand px-[22px] text-[16px] text-on-brand`}
        >
          {t('landing.cookie.accept')}
        </button>
      </div>
    </div>
  );
}

function readCookieChoice(): boolean {
  try {
    return window.localStorage.getItem(COOKIE_KEY) === '1';
  } catch {
    return false;
  }
}

/** The address of the site for a visitor: what the product is, what it costs, and the way to the first lesson. */
export function LandingPage() {
  const { t } = useTranslation();
  const scheme = useScheme();
  const dark = scheme === 'dark';
  const status = useAppSelector((state) => state.auth.status);
  const plans = usePlansQuery();
  const [cookieClosed, setCookieClosed] = useState(readCookieChoice);

  if (status === 'authenticated') return <Navigate to="/learn" replace />;

  const month = plans.data?.plans.find((plan) => plan.key === 'month');
  const year = plans.data?.plans.find((plan) => plan.key === 'year');
  const free = t('landing.pricing.free.items', { returnObjects: true }) as string[];
  const missing = t('landing.pricing.free.missing', { returnObjects: true }) as string[];
  const premium = t('landing.pricing.premium.items', { returnObjects: true }) as string[];
  const steps = t('landing.how.steps', { returnObjects: true }) as {
    title: string;
    text: string;
  }[];
  const stepTones = ['bg-brand text-on-brand', 'bg-sun text-on-accent', 'bg-mint text-on-accent'];

  function closeCookie() {
    setCookieClosed(true);
    try {
      window.localStorage.setItem(COOKIE_KEY, '1');
    } catch {
      // Not remembered this time: the notice shows again on the next visit
    }
  }

  const section = 'px-4 py-14 tablet:px-12 tablet:py-[72px] laptop:px-24 laptop:py-24';
  const heading =
    'm-0 text-center text-[28px] leading-9 font-extrabold text-balance tablet:text-[36px] tablet:leading-[44px] laptop:text-left';

  return (
    <div className="min-h-screen overflow-x-clip bg-bg text-text">
      <header className="flex h-16 items-center gap-6 px-4 tablet:h-20 tablet:px-12 laptop:px-24">
        <Link to="/" className="flex items-center gap-2.5 text-text no-underline">
          <Mascot mood="idle" size={44} dark={dark} />
          <b className="font-heading text-[19px] font-bold">{t('landing.brand')}</b>
        </Link>
        <nav aria-label={t('landing.sections')} className="ml-6 hidden gap-1 laptop:flex">
          {(['features', 'how', 'pricing', 'faq'] as const).map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex h-11 items-center rounded-input px-3.5 text-[16px] font-extrabold text-text-2 no-underline"
            >
              {t(`landing.nav.${id}`)}
            </a>
          ))}
        </nav>
        <span className="flex-1" />
        <Link
          to="/login"
          className="hidden h-11 items-center rounded-input px-4 text-[16px] font-extrabold text-brand-text no-underline tablet:flex"
        >
          {t('landing.nav.signIn')}
        </Link>
        <Link
          to="/onboarding"
          className={`${LINK_BUTTON} h-11 rounded-input bg-brand px-[18px] text-[16px] text-on-brand no-underline`}
        >
          <span className="tablet:hidden">{t('landing.nav.startShort')}</span>
          <span className="hidden tablet:inline">{t('landing.nav.start')}</span>
        </Link>
      </header>

      <main>
        <section className="grid items-center gap-6 px-4 pt-8 pb-14 tablet:px-12 laptop:grid-cols-[1.05fr_1fr] laptop:gap-12 laptop:px-24 laptop:pt-14 laptop:pb-24">
          <div className="flex flex-col items-center gap-5 text-center laptop:items-start laptop:text-left">
            <span className="inline-flex h-9 items-center gap-2 rounded-pill border-2 border-line bg-surface px-3.5 text-[14px] font-extrabold text-text-2">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-mint" />
              {t('landing.hero.chip')}
            </span>
            <h1 className="m-0 text-[36px] leading-[44px] font-extrabold tracking-[-0.01em] text-balance tablet:text-[56px] tablet:leading-[64px]">
              {t('landing.hero.title')}
            </h1>
            <p className="m-0 max-w-[560px] text-[18px] leading-7 font-semibold text-text-2 tablet:text-[20px] tablet:leading-[30px]">
              {t('landing.hero.lead')}
            </p>
            <div className="mt-1.5 flex w-full flex-col gap-3.5 tablet:w-auto tablet:flex-row">
              <Link
                to="/onboarding"
                className={`${LINK_BUTTON} h-[60px] bg-brand px-8 text-[20px] text-on-brand no-underline`}
              >
                {t('landing.hero.start')}
              </Link>
              <Link
                to="/login"
                className={`${LINK_BUTTON} h-[60px] bg-surface px-7 text-[18px] text-text no-underline`}
              >
                {t('landing.hero.haveAccount')}
              </Link>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="relative flex h-[380px] items-center justify-center tablet:h-[480px] laptop:h-[520px]"
          >
            <div className="absolute size-80 rounded-full bg-brand-tint tablet:size-[440px] laptop:size-[480px]" />
            <div className="relative translate-x-8 -rotate-6">
              <DemoBoard
                fen="r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R"
                className="w-[220px] tablet:w-[300px] laptop:w-[340px]"
                arrows={[{ from: 'f1', to: 'c4', color: 'sky' }]}
                lastMove={{ from: 'b8', to: 'c6' }}
              />
            </div>
            <div className="absolute -left-2 bottom-0 tablet:left-[12%] laptop:bottom-2.5 laptop:left-0">
              <Mascot mood="wave" size={230} dark={dark} animate />
            </div>
            <div className="absolute top-2.5 right-0 rotate-3 rounded-[18px] border-2 border-line bg-surface px-4 py-3 text-[17px] font-extrabold tablet:right-[10%] laptop:top-10 laptop:right-0">
              {t('landing.hero.bubble')}
            </div>
            <div className="absolute right-2 bottom-5 flex -rotate-[4deg] items-center gap-2 rounded-pill border-2 border-edge bg-sun px-3.5 py-2 text-[16px] font-extrabold text-on-accent shadow-shashka tablet:right-[14%] laptop:right-[30px] laptop:bottom-10">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="#FFFFFF"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              >
                <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
              </svg>
              {t('landing.hero.xp')}
            </div>
          </div>
        </section>

        <section id="features" className={`${section} flex flex-col gap-8`}>
          <div className="flex flex-col items-center gap-2.5 text-center laptop:items-start laptop:text-left">
            <span className="text-[14px] font-extrabold tracking-[0.08em] text-brand-text uppercase">
              {t('landing.features.eyebrow')}
            </span>
            <h2 className={`${heading} laptop:text-left`}>{t('landing.features.title')}</h2>
          </div>
          <div className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-4">
            <FeatureCard
              tone="bg-brand text-on-brand"
              title={t('landing.features.lessons.title')}
              text={t('landing.features.lessons.text')}
            >
              <MiniBoard piece="n" size={180} moves />
            </FeatureCard>
            <FeatureCard
              tone="bg-sun text-on-accent"
              title={t('landing.features.puzzles.title')}
              text={t('landing.features.puzzles.text')}
            >
              <DemoBoard
                fen="6k1/5ppp/8/8/8/8/5PPP/3R2K1"
                size={180}
                arrows={[{ from: 'd1', to: 'd8', color: 'brand' }]}
              />
            </FeatureCard>
            <FeatureCard
              tone="bg-mint text-on-accent"
              title={t('landing.features.bots.title')}
              text={t('landing.features.bots.text')}
            >
              <div aria-hidden="true" className="grid grid-cols-3 gap-2">
                {BOT_KINDS.map((kind) => (
                  <BotAvatar key={kind} kind={kind} size={64} />
                ))}
              </div>
            </FeatureCard>
            <FeatureCard
              tone="bg-sky text-on-accent"
              title={t('landing.features.analysis.title')}
              text={t('landing.features.analysis.text')}
            >
              <svg
                className="w-full"
                height="150"
                viewBox="0 0 260 150"
                role="img"
                aria-label={t('landing.features.analysis.chart')}
              >
                <rect width="260" height="150" rx="18" fill="var(--color-surface)" />
                <rect y="75" width="260" height="75" fill="var(--color-sky-tint)" />
                <polyline
                  points="16,70 50,64 84,60 118,56 152,110 186,104 220,122 244,130"
                  fill="none"
                  stroke="var(--color-edge)"
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle
                  cx="152"
                  cy="110"
                  r="8"
                  fill="var(--color-coral)"
                  stroke="var(--color-surface)"
                  strokeWidth="3"
                />
              </svg>
            </FeatureCard>
          </div>
        </section>

        <section
          id="how"
          className={`${section} flex flex-col gap-8 border-y-2 border-line bg-surface`}
        >
          <h2 className={heading}>{t('landing.how.title')}</h2>
          <ol className="m-0 grid list-none gap-6 p-0 tablet:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-3 rounded-panel border-2 border-line p-6"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-14 items-center justify-center rounded-full border-2 border-edge font-heading text-[22px] font-bold shadow-shashka ${stepTones[index]}`}
                >
                  {index + 1}
                </span>
                <b className="text-[22px] leading-[30px]">{step.title}</b>
                <span className="text-[16px] leading-6 font-semibold text-text-2">{step.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-label={t('landing.quotes.label')}
          className={`${section} flex flex-col gap-8`}
        >
          <h2 className={heading}>{t('landing.quotes.title')}</h2>
          <div className="grid gap-6 tablet:grid-cols-3">
            <Quote
              tone="border-mint-border bg-mint-tint text-mint-text"
              mood="happy"
              text={t('landing.quotes.good.text')}
              caption={t('landing.quotes.good.caption')}
              dark={dark}
            />
            <Quote
              tone="border-coral-border bg-coral-tint text-coral-text"
              mood="oops"
              text={t('landing.quotes.oops.text')}
              caption={t('landing.quotes.oops.caption')}
              dark={dark}
            />
            <Quote
              tone="border-sky-border bg-sky-tint text-sky-text"
              mood="hint"
              text={t('landing.quotes.hint.text')}
              caption={t('landing.quotes.hint.caption')}
              dark={dark}
            />
          </div>
        </section>

        <section
          id="pricing"
          className={`${section} flex flex-col gap-8 border-y-2 border-line bg-surface`}
        >
          <div className="flex flex-col items-center gap-2.5 text-center laptop:items-start laptop:text-left">
            <h2 className={`${heading} laptop:text-left`}>{t('landing.pricing.title')}</h2>
            <p className="m-0 text-[18px] leading-7 font-semibold text-text-2">
              {t('landing.pricing.lead')}
            </p>
          </div>
          <div className="grid items-start gap-6 tablet:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-[28px] border-2 border-line bg-surface p-7">
              <div className="flex items-baseline justify-between">
                <h3 className="m-0 font-heading text-[24px] leading-8 font-bold">
                  {t('landing.pricing.free.title')}
                </h3>
                <b className="text-[22px]">{t('landing.pricing.free.price')}</b>
              </div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {free.map((label) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 text-[17px] leading-[26px] font-bold"
                  >
                    <Tick ok tone="free" />
                    <span className="sr-only">{t('landing.pricing.included')}: </span>
                    {label}
                  </li>
                ))}
                {missing.map((label) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 text-[17px] leading-[26px] font-bold text-text-2"
                  >
                    <Tick ok={false} tone="free" />
                    <span className="sr-only">{t('landing.pricing.notIncluded')}: </span>
                    {label}
                  </li>
                ))}
              </ul>
              <Link
                to="/onboarding"
                className={`${LINK_BUTTON} mt-2 h-14 bg-surface text-[18px] text-text no-underline`}
              >
                {t('landing.pricing.free.cta')}
              </Link>
            </div>
            <div className="relative flex flex-col gap-4 rounded-[28px] border-3 border-edge bg-surface p-7 shadow-shashka-lg">
              <div aria-hidden="true" className="absolute -top-16 right-5">
                <Mascot mood="proud" size={96} dark={dark} />
              </div>
              <div className="flex items-center gap-2.5">
                <h3 className="m-0 font-heading text-[24px] leading-8 font-bold">
                  {t('landing.pricing.premium.title')}
                </h3>
                <span className="flex h-7 items-center rounded-pill bg-sun px-2.5 text-[13px] font-extrabold text-on-accent">
                  {t('landing.pricing.premium.chip')}
                </span>
              </div>
              {month && year && (
                <div className="flex flex-wrap gap-3 text-[18px] font-extrabold">
                  <span>{t('landing.pricing.premium.month', { price: month.priceRub })}</span>
                  <span className="text-text-2">
                    {t('landing.pricing.premium.year', { price: year.priceRub })}
                  </span>
                </div>
              )}
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {premium.map((label) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 text-[17px] leading-[26px] font-bold"
                  >
                    <Tick ok tone="premium" />
                    {label}
                  </li>
                ))}
              </ul>
              <Link
                to="/premium"
                className={`${LINK_BUTTON} mt-2 h-14 bg-brand text-[18px] text-on-brand no-underline`}
              >
                {t('landing.pricing.premium.cta')}
              </Link>
              <span className="text-[13px] leading-[18px] font-semibold text-text-2">
                {t('landing.pricing.premium.note')}{' '}
                <Link to="/offer" className="font-extrabold">
                  {t('landing.pricing.premium.offer')}
                </Link>
              </span>
            </div>
          </div>
        </section>

        <section id="faq" className={`${section} flex flex-col items-center gap-6`}>
          <h2 className="m-0 text-[28px] leading-9 font-extrabold tablet:text-[36px] tablet:leading-[44px]">
            {t('landing.faq.title')}
          </h2>
          <Faq />
        </section>

        <section className="mx-4 mb-14 flex flex-col items-center gap-6 rounded-[32px] border-2 border-edge bg-brand p-6 text-center text-on-brand shadow-shashka-lg tablet:mx-12 tablet:mb-[72px] tablet:p-10 laptop:mx-24 laptop:mb-24 laptop:flex-row laptop:text-left">
          <Mascot mood="cheer" size={200} dark={dark} />
          <div className="flex flex-1 flex-col items-center gap-3 laptop:items-start">
            <h2 className="m-0 text-[28px] leading-9 font-extrabold text-balance tablet:text-[36px] tablet:leading-[44px]">
              {t('landing.cta.title')}
            </h2>
            <p className="m-0 text-[18px] leading-7 font-semibold">{t('landing.cta.text')}</p>
          </div>
          <Link
            to="/onboarding"
            className={`${LINK_BUTTON} h-[60px] shrink-0 bg-surface px-8 text-[20px] text-brand-text no-underline`}
          >
            {t('landing.cta.start')}
          </Link>
        </section>
      </main>

      <footer className="flex flex-col justify-between gap-6 bg-ink px-4 py-10 text-on-ink tablet:flex-row tablet:px-12 laptop:px-24">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <Mascot mood="idle" size={44} dark />
            <b className="text-[20px] font-extrabold">{t('landing.brand')}</b>
          </div>
          <span className="text-[14px] font-semibold text-text-muted">
            {t('landing.footer.about')}
          </span>
        </div>
        <nav
          aria-label={t('landing.footer.documents')}
          className="flex flex-col gap-x-6 gap-y-2 text-[16px] font-extrabold tablet:flex-row"
        >
          <Link to="/offer" className="flex min-h-11 items-center text-on-ink">
            {t('landing.footer.offer')}
          </Link>
          <Link to="/privacy" className="flex min-h-11 items-center text-on-ink">
            {t('landing.footer.privacy')}
          </Link>
          <Link to="/privacy#contacts" className="flex min-h-11 items-center text-on-ink">
            {t('landing.footer.contacts')}
          </Link>
        </nav>
      </footer>

      {!cookieClosed && <CookieNotice onClose={closeCookie} />}
    </div>
  );
}
