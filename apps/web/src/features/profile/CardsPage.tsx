import { boardReducer, createBoardState, type BoardAction } from '@kotgambit/board-controller';
import { createCoach, type CoachMessage } from '@kotgambit/coach';
import { apiErrorOf, type CardAnswerResponse, type ReviewCard } from '@kotgambit/contracts';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAnswerCardMutation, useNextCardMutation } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { CloseIcon } from '../../shared/ui/icons';
import { ReplyCard, type ReplyTone } from '../../shared/ui/ReplyCard';
import { Board } from '../board';
import { Mascot } from '../mascot/Mascot';
import { PremiumNudge } from '../premium/PremiumNudge';
import { useScheme } from '../theme/useScheme';

const TONES: Record<CoachMessage['tone'], ReplyTone> = {
  neutral: 'neutral',
  success: 'success',
  oops: 'oops',
  hint: 'hint',
  demo: 'hint',
  celebrate: 'success',
  soft: 'info',
};

type Answered = Exclude<CardAnswerResponse, { result: 'illegal' }>;

/** Repeating the positions of the learner's own mistakes, one card at a time. */
export function CardsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const status = useAppSelector((state) => state.auth.status);
  const [nextCard] = useNextCardMutation();
  const [card, setCard] = useState<ReviewCard | null>(null);
  const [left, setLeft] = useState(0);
  const [load, setLoad] = useState<'loading' | 'ready' | 'empty' | 'premium' | 'error'>('loading');
  const requested = useRef(false);

  async function fetchCard() {
    setLoad('loading');
    const result = await nextCard();
    if ('data' in result && result.data) {
      setLeft(result.data.summary.due);
      setCard(result.data.card);
      setLoad(result.data.card ? 'ready' : 'empty');
    } else {
      setLoad(apiErrorOf(result.error)?.code === 'premium.required' ? 'premium' : 'error');
    }
  }

  // Once per screen: the next card comes from the button
  useEffect(() => {
    if (status !== 'authenticated' || requested.current) return;
    requested.current = true;
    void fetchCard();
    // `fetchCard` does not read anything that changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const leave = () => void navigate('/');

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex min-h-20 items-center gap-3 px-4 tablet:px-8">
        <IconButton quiet label={t('cards.close')} onClick={leave}>
          <CloseIcon />
        </IconButton>
        <h1 className="m-0 font-heading text-[22px] font-bold">{t('cards.title')}</h1>
        {load === 'ready' && (
          <span className="ml-auto rounded-pill bg-sky-tint px-3.5 py-1 text-[14px] font-extrabold text-sky-text">
            {t('cards.left', { count: left })}
          </span>
        )}
      </header>
      <main className="flex-1">
        {load === 'premium' ? (
          <PremiumNudge kind="cards" />
        ) : load === 'ready' && card ? (
          <CardSolver key={card.id} card={card} onNext={() => void fetchCard()} />
        ) : (
          <Waiting load={load} onRetry={() => void fetchCard()} onLeave={leave} />
        )}
      </main>
    </div>
  );
}

function Waiting({
  load,
  onRetry,
  onLeave,
}: {
  load: 'loading' | 'ready' | 'empty' | 'premium' | 'error';
  onRetry: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const scheme = useScheme();
  const coach = useMemo(() => createCoach(), []);
  const empty = load === 'empty' ? coach.message({ type: 'CARD_EMPTY' }) : null;
  return (
    <div
      role={load === 'loading' ? 'status' : undefined}
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <Mascot
        mood={empty ? empty.mascot : load === 'error' ? 'oops' : 'thinking'}
        size={150}
        dark={scheme === 'dark'}
        animate
      />
      <h2 className="m-0 max-w-[600px] font-heading text-[24px] leading-9 font-bold">
        {empty ? empty.title : load === 'error' ? t('cards.loadError') : t('cards.loading')}
      </h2>
      {empty && (
        <p className="m-0 max-w-[600px] text-[18px] font-semibold text-text-2">{empty.text}</p>
      )}
      {load !== 'loading' && (
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={onLeave}>
            {t('cards.close')}
          </Button>
          {load === 'error' && <Button onClick={onRetry}>{t('cards.retry')}</Button>}
        </div>
      )}
    </div>
  );
}

function CardSolver({ card, onNext }: { card: ReviewCard; onNext: () => void }) {
  const { t } = useTranslation();
  const scheme = useScheme();
  const coach = useMemo(() => createCoach(), []);
  const [board, boardDispatch] = useReducer(boardReducer, undefined, () =>
    createBoardState({ fen: card.fen, orientation: card.solver }),
  );
  const [answer] = useAnswerCardMutation();
  const [result, setResult] = useState<Answered | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(uci: string) {
    setBusy(true);
    setFailed(false);
    const response = await answer({ cardId: card.id, move: uci });
    setBusy(false);
    if (!('data' in response) || !response.data) {
      setFailed(true);
      boardDispatch({ type: 'position/set', fen: card.fen });
      return;
    }
    if (response.data.result === 'illegal') {
      boardDispatch({ type: 'position/set', fen: card.fen });
      return;
    }
    setResult(response.data);
  }

  function onBoardAction(action: BoardAction) {
    const next = boardReducer(board, action);
    boardDispatch(action);
    if (next.lastMove && next.lastMove !== board.lastMove && !busy && !result) {
      void submit(next.lastMove.uci);
    }
  }

  const message = useMemo<CoachMessage>(
    () =>
      coach.message({
        type: result ? (result.result === 'correct' ? 'CARD_CORRECT' : 'CARD_WRONG') : 'CARD_START',
      }),
    [coach, result],
  );
  const bestArrow =
    result?.result === 'wrong'
      ? [
          {
            from: result.best.uci.slice(0, 2),
            to: result.best.uci.slice(2, 4),
            color: 'mint' as const,
          },
        ]
      : [];

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-8 px-4 pr-6 pb-10 laptop:grid-cols-[minmax(0,560px)_minmax(0,460px)] laptop:justify-center">
      <div className="flex flex-col gap-3">
        <Board
          state={board}
          dispatch={onBoardAction}
          disabled={busy || result !== null}
          arrows={bestArrow}
        />
        <p className="m-0 text-[14px] font-semibold text-text-muted">{t('cards.boardNote')}</p>
        {failed && <Banner>{t('cards.moveError')}</Banner>}
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="m-0 font-heading text-[26px] leading-9 font-bold">
          {t(`cards.turn.${card.solver}`)}
        </h2>
        <p className="m-0 text-[15px] font-semibold text-text-2">
          {t('cards.played', { san: card.playedSan, number: card.moveNumber })}
        </p>
        <ReplyCard
          tone={TONES[message.tone]}
          title={message.title}
          actions={
            result && (
              <Button
                variant={result.result === 'correct' ? 'success' : 'primary'}
                large
                onClick={onNext}
                data-autofocus
              >
                {t('cards.next')}
              </Button>
            )
          }
        >
          {result
            ? `${message.text} ${t('cards.better', { san: result.best.san })} ${t('cards.again', { count: result.nextInDays })}`
            : message.text}
        </ReplyCard>
        <div className="pl-4">
          <Mascot mood={message.mascot} size={110} dark={scheme === 'dark'} animate />
        </div>
      </div>
    </div>
  );
}
