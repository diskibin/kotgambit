import { createBoardState } from '@kotgambit/board-controller';
import type { PieceType } from '@kotgambit/chess-core';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useAppSelector } from '../../app/hooks';
import { Button } from '../../shared/ui/Button';
import { PlayIcon } from '../../shared/ui/icons';
import { Board } from '../board';
import { pieceUrl } from '../board/pieceAssets';
import type { Mood } from '@kotgambit/mascot';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import {
  DEFAULT_ONBOARDING,
  FIRST_LESSON,
  GOALS,
  LEVELS,
  savePending,
  type Goal,
  type Level,
} from './onboardingAnswers';

const STEPS = 4;
const NOOP = () => undefined;
const LEVEL_PIECE: Record<Level, PieceType> = { novice: 'p', basics: 'n', player: 'q' };
const GOAL_NOTE: Record<Goal, 'easy' | 'normal' | 'serious'> = {
  5: 'easy',
  10: 'normal',
  15: 'serious',
};
const RING_RADIUS = 40;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-reply border-2 border-line bg-surface px-6 py-5 text-left">
      {children}
      <span
        aria-hidden="true"
        className="absolute top-1/2 -left-[11px] hidden size-[18px] -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-line bg-surface laptop:block"
      />
    </div>
  );
}

function Choice({
  selected,
  onSelect,
  className,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`rounded-panel border-2 text-left transition-[transform,box-shadow] duration-press ease-spring motion-reduce:transition-none ${selected ? 'border-edge bg-brand-tint shadow-shashka' : 'border-line bg-surface'} ${className}`}
    >
      {children}
    </button>
  );
}

function Tick({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface'}`}
    >
      {selected && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </span>
  );
}

function Ring({ share }: { share: number }) {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" className="-rotate-90">
      <circle
        cx="48"
        cy="48"
        r={RING_RADIUS}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="12"
      />
      <circle
        cx="48"
        cy="48"
        r={RING_RADIUS}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${RING_LENGTH * share} ${RING_LENGTH}`}
      />
    </svg>
  );
}

function CatWithBubble({
  mood,
  size,
  dark,
  children,
}: {
  mood: Mood;
  size: number;
  dark: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 laptop:flex-row laptop:gap-8">
      <Mascot mood={mood} size={size} dark={dark} animate />
      <Bubble>{children}</Bubble>
    </div>
  );
}

/** Four short steps before the first lesson: who the learner is, how much time they have, and where to start. */
export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  const dark = scheme === 'dark';
  const params = useParams();
  const status = useAppSelector((state) => state.auth.status);
  const [level, setLevel] = useState<Level>(DEFAULT_ONBOARDING.level);
  const [goal, setGoal] = useState<Goal>(DEFAULT_ONBOARDING.goal);
  const lesson = FIRST_LESSON[level];
  const knightBoard = useMemo(
    () => createBoardState({ fen: '8/8/8/8/3N4/8/8/8 w - - 0 1', orientation: 'w' }),
    [],
  );

  if (status === 'authenticated') return <Navigate to="/learn" replace />;

  const step = Number(params['step'] ?? 1);
  if (!Number.isInteger(step) || step < 1 || step > STEPS) {
    return <Navigate to="/onboarding/1" replace />;
  }

  function next() {
    if (step < STEPS) {
      void navigate(`/onboarding/${step + 1}`);
      return;
    }
    // The lesson needs an account to keep its progress: the answers wait on the device and follow the sign-up
    savePending({ level, goal });
    void navigate('/register');
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex h-16 items-center gap-4 px-4 tablet:h-24 tablet:px-12">
        <Link to="/" className="flex items-center gap-2.5 text-text no-underline">
          <Mascot mood="idle" size={44} dark={dark} />
          <b className="hidden font-heading text-[19px] font-bold tablet:inline">
            {t('onboarding.brand')}
          </b>
        </Link>
        <div
          role="progressbar"
          aria-label={t('onboarding.progress')}
          aria-valuemin={1}
          aria-valuemax={STEPS}
          aria-valuenow={step}
          aria-valuetext={t('onboarding.step', { current: step, total: STEPS })}
          className="flex flex-1 justify-center gap-2"
        >
          {Array.from({ length: STEPS }, (_, index) => (
            <span
              key={index}
              className={`h-3 flex-1 rounded-pill tablet:max-w-16 ${index < step ? 'bg-brand' : 'bg-line'}`}
            />
          ))}
        </div>
        <span className="hidden text-[16px] font-bold text-text-2 tablet:block">
          {t('onboarding.step', { current: step, total: STEPS })}
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-6 tablet:px-12">
        {step === 1 && (
          <CatWithBubble mood="wave" size={260} dark={dark}>
            <h1 className="m-0 font-heading text-[28px] leading-9 font-bold tablet:text-[36px] tablet:leading-[44px]">
              {t('onboarding.hello.title')}
            </h1>
            <p className="m-0 mt-2 text-[20px] leading-7 font-semibold text-text-2">
              {t('onboarding.hello.text')}
            </p>
          </CatWithBubble>
        )}

        {step === 2 && (
          <div className="flex w-full max-w-[600px] flex-col items-center gap-6">
            <CatWithBubble mood="thinking" size={160} dark={dark}>
              <h1 className="m-0 font-heading text-[24px] leading-8 font-bold">
                {t('onboarding.level.question')}
              </h1>
            </CatWithBubble>
            <div
              role="radiogroup"
              aria-label={t('onboarding.level.group')}
              className="flex w-full flex-col gap-3"
            >
              {LEVELS.map((item) => (
                <Choice
                  key={item}
                  selected={level === item}
                  onSelect={() => setLevel(item)}
                  className="flex min-h-[92px] items-center gap-4 px-5 py-3"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-[52px] shrink-0 items-center justify-center rounded-card bg-surface-2"
                  >
                    <img src={pieceUrl('w', LEVEL_PIECE[item])} alt="" width={40} height={40} />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <b className="text-[20px] leading-7">{t(`onboarding.level.${item}.title`)}</b>
                    <span className="text-[16px] leading-6 font-semibold text-text-2">
                      {t(`onboarding.level.${item}.text`)}
                    </span>
                  </span>
                  <Tick selected={level === item} />
                </Choice>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex w-full max-w-[760px] flex-col items-center gap-6">
            <CatWithBubble mood="idle" size={160} dark={dark}>
              <h1 className="m-0 font-heading text-[24px] leading-8 font-bold">
                {t('onboarding.goal.question')}
              </h1>
            </CatWithBubble>
            <div
              role="radiogroup"
              aria-label={t('onboarding.goal.group')}
              className="grid w-full gap-4 tablet:grid-cols-3"
            >
              {GOALS.map((item, index) => (
                <Choice
                  key={item}
                  selected={goal === item}
                  onSelect={() => setGoal(item)}
                  className="flex min-h-[232px] flex-col items-center justify-center gap-3 p-5 text-center"
                >
                  <Ring share={(index + 1) / GOALS.length} />
                  <b className="text-[22px]">{t('onboarding.goal.minutes', { count: item })}</b>
                  <span className="text-[16px] font-semibold text-text-2">
                    {t(`onboarding.goal.${GOAL_NOTE[item]}`)}
                  </span>
                </Choice>
              ))}
            </div>
            <p className="m-0 text-center text-[16px] font-semibold text-text-2">
              {t('onboarding.goal.note')}
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="flex w-full max-w-[480px] flex-col items-center gap-4">
            <div className="rounded-reply border-2 border-line bg-surface px-6 py-5 text-center">
              <h1 className="m-0 font-heading text-[24px] leading-8 font-bold">
                {t('onboarding.first.title')}
              </h1>
              <p className="m-0 mt-1 text-[16px] leading-6 font-semibold text-text-2">
                {t('onboarding.first.summary', {
                  goal,
                  level: t(`onboarding.first.levels.${level}`),
                })}
              </p>
            </div>
            <Mascot mood="proud" size={200} dark={dark} animate />
            <article className="w-full overflow-hidden rounded-panel border-2 border-edge bg-surface shadow-shashka-lg">
              <div className="bg-brand px-6 py-4 text-on-brand">
                <span className="text-[14px] font-extrabold">
                  {t(`onboarding.first.lessons.${level}.track`)}
                </span>
                <h2 className="m-0 font-heading text-[22px] leading-8 font-bold">
                  {t(`onboarding.first.lessons.${level}.title`)}
                </h2>
                {level === 'basics' && (
                  <p className="m-0 text-[14px] font-semibold">{t('onboarding.first.skipped')}</p>
                )}
              </div>
              <div className="flex items-center gap-4 p-4">
                <div aria-hidden="true" inert className="w-[120px] shrink-0 tablet:w-[200px]">
                  <Board
                    state={knightBoard}
                    dispatch={NOOP}
                    coords={false}
                    disabled
                    onSquarePress={NOOP}
                    hintSquares={['c6', 'e6', 'f5', 'f3', 'e2', 'c2', 'b3', 'b5']}
                  />
                </div>
                <div className="flex flex-col items-start gap-2 text-[16px] font-bold">
                  <span>{t('onboarding.first.minutes', { count: lesson.minutes })}</span>
                  <span>{t('onboarding.first.steps', { count: lesson.steps })}</span>
                  <span className="rounded-pill bg-sun px-3 py-1 text-[14px] font-extrabold text-on-accent">
                    {t('onboarding.first.xp')}
                  </span>
                </div>
              </div>
            </article>
          </div>
        )}
      </main>

      <footer className="flex min-h-24 items-center justify-between gap-4 border-t-2 border-line bg-surface px-4 py-4 tablet:min-h-[120px] tablet:px-12">
        {step > 1 ? (
          <Button variant="secondary" onClick={() => void navigate(`/onboarding/${step - 1}`)}>
            {t('onboarding.back')}
          </Button>
        ) : (
          <span />
        )}
        <Button
          large
          variant={step === STEPS ? 'success' : 'primary'}
          className="flex-1 tablet:w-[280px] tablet:flex-none"
          onClick={next}
        >
          {step === STEPS && <PlayIcon size={22} />}
          {step === STEPS ? t('onboarding.first.start') : t('onboarding.next')}
        </Button>
      </footer>
    </div>
  );
}
