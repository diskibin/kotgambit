import { apiErrorOf, type Puzzle, type PuzzleMode } from '@kotgambit/contracts';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useCardSummaryQuery, useNextPuzzleMutation, usePuzzleStatsQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { localDateKey } from '../../shared/localDate';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { CloseIcon } from '../../shared/ui/icons';
import { Mascot } from '../mascot/Mascot';
import { PremiumNudge } from '../premium/PremiumNudge';
import { useScheme } from '../theme/useScheme';
import { PuzzleSolver } from './PuzzleSolver';

const MODES: readonly PuzzleMode[] = ['rating', 'theme', 'review', 'daily'];
const HTTP_UNAVAILABLE = 503;
const HTTP_NOT_FOUND = 404;

type Load = 'loading' | 'ready' | 'none' | 'busy' | 'limit' | 'error';

function parseMode(value: string | null): PuzzleMode {
  return MODES.find((mode) => mode === value) ?? 'rating';
}

function statusOf(error: unknown): number | null {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : null;
}

/** The solving screen in focus mode: takes a puzzle from the server and hands it to the solver. */
export function PuzzlePage() {
  const [params] = useSearchParams();
  const mode = parseMode(params.get('mode'));
  const theme = params.get('theme') ?? undefined;
  // Another mode or theme is another screen with fresh state
  return <PuzzleScreen key={`${mode}:${theme ?? ''}`} mode={mode} theme={theme} />;
}

function PuzzleScreen({ mode, theme }: { mode: PuzzleMode; theme: string | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  const authStatus = useAppSelector((state) => state.auth.status);
  const [nextPuzzle] = useNextPuzzleMutation();
  const stats = usePuzzleStatsQuery(undefined, { skip: authStatus !== 'authenticated' });
  // The mistakes of games are kept apart from the puzzles that went wrong, the way to them is shown beside
  const cards = useCardSummaryQuery(undefined, { skip: authStatus !== 'authenticated' });
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [load, setLoad] = useState<Load>('loading');
  const [serverMessage, setServerMessage] = useState('');
  const requested = useRef(false);

  /** Asks for a puzzle and shows what came of it. The state changes only once the answer is in. */
  async function fetchPuzzle() {
    const result = await nextPuzzle({
      mode,
      ...(theme ? { theme } : {}),
      localDate: localDateKey(),
    });
    if ('data' in result && result.data) {
      setPuzzle(result.data);
      setLoad('ready');
      return;
    }
    const status = statusOf(result.error);
    const problem = apiErrorOf(result.error);
    setServerMessage(problem?.message ?? '');
    setLoad(
      problem?.code === 'puzzle.limit'
        ? 'limit'
        : status === HTTP_NOT_FOUND
          ? 'none'
          : status === HTTP_UNAVAILABLE
            ? 'busy'
            : 'error',
    );
  }

  /** "Next puzzle" and "Try again": the screen shows that it is working before the answer comes. */
  function start() {
    setLoad('loading');
    void fetchPuzzle();
  }

  // Once per screen: a second request would leave the first attempt behind as a skip
  useEffect(() => {
    if (authStatus !== 'authenticated' || requested.current) return;
    requested.current = true;
    void fetchPuzzle();
    // `fetchPuzzle` only reads the mode and the theme, which are fixed for this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  if (authStatus === 'anonymous') return <Navigate to="/login" replace />;

  const leave = () => void navigate('/puzzles');
  // The puzzle of the day is the same all day, so "next" after it moves on to the puzzles for the rating
  const next = () =>
    mode === 'daily' ? void navigate('/puzzles/solve?mode=rating', { replace: true }) : start();

  if (load === 'limit') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-text">
        <PremiumNudge kind="puzzles" />
        <Button variant="secondary" onClick={leave}>
          {t('puzzles.mistakes.back')}
        </Button>
      </div>
    );
  }

  if (load === 'ready' && puzzle) {
    return (
      <div className="flex min-h-screen flex-col bg-bg text-text">
        <header className="flex min-h-20 flex-wrap items-center gap-3 px-4 tablet:px-8">
          <IconButton quiet label={t('puzzles.solve.close')} onClick={leave}>
            <CloseIcon />
          </IconButton>
          {mode === 'theme' && puzzle.themes[0] && (
            <span className="rounded-pill bg-surface-2 px-3.5 py-1 text-[14px] font-extrabold">
              {puzzle.themes[0].title}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {stats.data && stats.data.streak > 0 && (
              <span className="rounded-pill bg-mint-tint px-3.5 py-1 text-[14px] font-extrabold text-mint-text">
                {t('puzzles.solve.streak', { count: stats.data.streak })}
              </span>
            )}
            {stats.data && (
              <span className="rounded-pill bg-sky-tint px-3.5 py-1 text-[14px] font-extrabold text-sky-text">
                {t('puzzles.solve.ratingChip', { rating: stats.data.rating })}
              </span>
            )}
          </div>
        </header>
        <main className="flex-1">
          <PuzzleSolver key={puzzle.attemptId} puzzle={puzzle} onNext={next} />
        </main>
      </div>
    );
  }

  const state = {
    loading: {
      mood: 'thinking',
      chip: null,
      title: t('puzzles.solve.starting'),
      text: null,
      retry: false,
    },
    none:
      mode === 'review'
        ? {
            mood: 'proud',
            chip: null,
            title: t('puzzles.mistakes.emptyTitle'),
            text: t('puzzles.mistakes.emptyText'),
            retry: false,
          }
        : {
            mood: 'thinking',
            chip: null,
            title: serverMessage || t('puzzles.solve.noPuzzles'),
            text: null,
            retry: false,
          },
    busy: {
      mood: 'thinking',
      chip: t('puzzles.busy.chip'),
      title: t('puzzles.busy.title'),
      text: t('puzzles.busy.text'),
      retry: true,
    },
    error: {
      mood: 'oops',
      chip: null,
      title: t('puzzles.solve.loadError'),
      text: null,
      retry: true,
    },
    ready: { mood: 'thinking', chip: null, title: '', text: null, retry: false },
    // Shown by its own card above, this entry only keeps the table complete
    limit: { mood: 'thinking', chip: null, title: '', text: null, retry: false },
  }[load] as {
    mood: 'thinking' | 'proud' | 'oops';
    chip: string | null;
    title: string;
    text: string | null;
    retry: boolean;
  };

  return (
    <div
      role={load === 'loading' ? 'status' : undefined}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-text"
    >
      <Mascot
        mood={state.mood}
        size={load === 'loading' ? 140 : 180}
        dark={scheme === 'dark'}
        animate
      />
      {state.chip && (
        <span className="rounded-pill bg-sun-tint px-3.5 py-1 text-[14px] font-extrabold text-sun-text">
          {state.chip}
        </span>
      )}
      <h1 className="m-0 max-w-[600px] font-heading text-[26px] leading-9 font-bold">
        {state.title}
      </h1>
      {state.text && (
        <p className="m-0 max-w-[600px] text-[18px] font-semibold text-text-2">{state.text}</p>
      )}
      {load !== 'loading' && (
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={leave}>
            {t('puzzles.mistakes.back')}
          </Button>
          {load === 'none' && mode === 'review' && (cards.data?.total ?? 0) > 0 && (
            <Button onClick={() => void navigate('/cards')}>{t('puzzles.mistakes.toCards')}</Button>
          )}
          {state.retry && <Button onClick={start}>{t('puzzles.busy.retry')}</Button>}
        </div>
      )}
    </div>
  );
}
