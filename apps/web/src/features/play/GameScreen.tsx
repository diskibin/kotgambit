import { boardReducer, createBoardState, type BoardAction } from '@kotgambit/board-controller';
import { applyMove } from '@kotgambit/chess-core';
import { createCoach, type CoachMessage } from '@kotgambit/coach';
import type { BotProfile, Game } from '@kotgambit/contracts';
import {
  boardFen,
  canHint,
  canUndo,
  lastMove,
  movePairs,
  statusChip,
} from '@kotgambit/game-player';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  useCreateGameMutation,
  useLazyGameQuery,
  useMeQuery,
  useGameBotMoveMutation,
  useGameHintMutation,
  useGameMoveMutation,
  useGameResignMutation,
  useGameUndoMutation,
} from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { BulbIcon, CloseIcon, RetryIcon, UndoIcon } from '../../shared/ui/icons';
import { ReplyCard, type ReplyTone } from '../../shared/ui/ReplyCard';
import { Board } from '../board';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { BotAvatar } from './BotAvatar';
import { GameOverDialog, ResignDialog } from './GameDialogs';

// The engine usually frees up within a few seconds, so the screen asks again by itself a few times
const BOT_RETRY_DELAY_MS = 3000;
const MAX_AUTO_RETRIES = 5;
const HTTP_CONFLICT = 409;

const TONES: Record<CoachMessage['tone'], ReplyTone> = {
  neutral: 'neutral',
  success: 'success',
  oops: 'oops',
  hint: 'hint',
  demo: 'hint',
  celebrate: 'success',
  soft: 'info',
};

function statusOf(error: unknown): number | null {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : null;
}

const squares = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

interface GameScreenProps {
  bot: BotProfile;
}

/**
 * One game against a bot: the board, the list of moves and the cat's reply card. The server decides
 * what is legal and what the bot plays, the screen only shows the answer. When the engine is busy the
 * position is kept, and the bot's move is asked for again.
 */
export function GameScreen({ bot }: GameScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const scheme = useScheme();
  const session = useAppSelector((state) => state.gameSession);
  const game = session.game as Game;
  const coach = useMemo(() => createCoach(), []);
  const [board, boardDispatch] = useReducer(boardReducer, undefined, () =>
    createBoardState({ fen: boardFen(session) ?? game.fen, orientation: game.userColor }),
  );
  const [sendMove] = useGameMoveMutation();
  const [askBotMove] = useGameBotMoveMutation();
  const [askHint] = useGameHintMutation();
  const [takeBack] = useGameUndoMutation();
  const [resign] = useGameResignMutation();
  const [createGame, creation] = useCreateGameMutation();
  const [readGame] = useLazyGameQuery();
  const me = useMeQuery();
  const [networkFailed, setNetworkFailed] = useState(false);
  const [undone, setUndone] = useState(false);
  const [overOpen, setOverOpen] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const retries = useRef(0);

  const fen = boardFen(session) ?? game.fen;
  useEffect(() => {
    if (board.fen !== fen) boardDispatch({ type: 'position/set', fen });
  }, [fen, board.fen]);

  /** After a failed request the server may or may not have taken it: its copy of the game is the truth. */
  async function resync() {
    const result = await readGame(game.id);
    if (result.data) dispatch({ type: 'game/loaded', game: result.data });
  }

  async function submit(uci: string) {
    setNetworkFailed(false);
    setUndone(false);
    dispatch({ type: 'game/moveSent', move: uci });
    const result = await sendMove({ gameId: game.id, move: uci });
    if ('data' in result && result.data) {
      dispatch({ type: 'game/moveAnswered', response: result.data });
      return;
    }
    dispatch({ type: 'game/moveFailed' });
    setNetworkFailed(true);
    void resync();
  }

  function onBoardAction(action: BoardAction) {
    const next = boardReducer(board, action);
    boardDispatch(action);
    if (next.lastMove && next.lastMove !== board.lastMove && session.phase === 'playing') {
      void submit(next.lastMove.uci);
    }
  }

  async function requestBotMove() {
    const result = await askBotMove(game.id);
    if ('data' in result && result.data) {
      dispatch({ type: 'game/moveAnswered', response: result.data });
      return;
    }
    if (statusOf(result.error) === HTTP_CONFLICT) void resync();
    else setRetryTick((tick) => tick + 1);
  }

  // The bot did not answer: the engine was busy. Ask again a few times, then leave it to the button
  useEffect(() => {
    if (session.phase !== 'busy') {
      retries.current = 0;
      return;
    }
    if (retries.current >= MAX_AUTO_RETRIES) return;
    const timer = setTimeout(() => {
      retries.current += 1;
      void requestBotMove();
    }, BOT_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
    // `requestBotMove` only reads the game id, which is fixed for this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase, retryTick]);

  function retryNow() {
    retries.current = 0;
    void requestBotMove();
  }

  async function hint() {
    const result = await askHint(game.id);
    if ('data' in result && result.data) {
      dispatch({ type: 'game/hinted', move: result.data.move, hintsLeft: result.data.hintsLeft });
    }
  }

  async function undo() {
    const result = await takeBack(game.id);
    if ('data' in result && result.data) {
      setUndone(true);
      dispatch({ type: 'game/loaded', game: result.data });
    }
  }

  async function giveUp() {
    const result = await resign(game.id);
    if ('data' in result && result.data) {
      setOverOpen(true);
      dispatch({ type: 'game/loaded', game: result.data });
    } else {
      dispatch({ type: 'game/resignCancelled' });
      setNetworkFailed(true);
    }
  }

  async function playAgain() {
    const result = await createGame({
      botId: game.botId,
      color: game.userColor,
      learning: game.learning,
    });
    if ('data' in result && result.data)
      void navigate(`/play/${result.data.id}`, { replace: true });
    else void navigate('/play');
  }

  const { phase, hint: shownHint } = session;
  const result = game.result;
  const botGender = { name: bot.name, gender: bot.gender };
  const promoting = board.pendingPromotion !== null;
  const message = useMemo<CoachMessage>(() => {
    if (phase === 'over' && result) {
      return coach.message({
        type: 'GAME_OVER',
        outcome: result.outcome,
        reason: result.reason,
        bot: botGender,
      });
    }
    if (phase === 'busy') return coach.message({ type: 'GAME_BUSY' });
    if (promoting) return coach.message({ type: 'GAME_PROMOTION' });
    if (shownHint) {
      const played = applyMove(game.fen, shownHint);
      return coach.message({ type: 'GAME_HINT', san: played.ok ? played.move.san : shownHint });
    }
    if (game.inCheck && phase === 'playing') return coach.message({ type: 'GAME_CHECK' });
    if (undone) return coach.message({ type: 'GAME_UNDO' });
    if (game.moves.length === 0) return coach.message({ type: 'GAME_START' });
    return coach.message({ type: 'GAME_MOVE' });
    // The cat speaks again when the game moves on, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, game.moves.length, game.inCheck, shownHint, promoting, undone]);

  const chip = statusChip(session);
  const over = phase === 'over';
  const learnerInCheck = chip === 'check';
  const lastShown = lastMove(session);
  const pairs = movePairs(game);
  const initial = (me.data?.displayName ?? me.data?.email ?? '?').charAt(0).toUpperCase();
  const playing = phase === 'playing';

  const botStatus = (() => {
    if (over && result) {
      if (result.outcome === 'win') return t('play.game.status.mate');
      if (result.outcome === 'loss') return t('play.game.status.win');
      return result.reason === 'stalemate'
        ? t('play.game.status.stalemate')
        : t('play.game.status.draw');
    }
    if (chip === 'busy') return t('play.game.status.noAnswer');
    if (chip === 'thinking') return t('play.game.status.thinking');
    return learnerInCheck ? t('play.game.status.checkOnYou') : t('play.game.status.yourTurn');
  })();
  const playerStatus = (() => {
    if (over && result) {
      if (result.outcome === 'win') return t('play.game.status.win');
      if (result.outcome === 'loss' && result.reason === 'checkmate') {
        return t('play.game.status.mate');
      }
      return null;
    }
    if (learnerInCheck) return t('play.game.status.check');
    return playing ? t('play.game.status.yourTurn') : t('play.game.status.waiting');
  })();

  const colorName = (color: 'w' | 'b') => t(`play.game.colorBy.${color}`);
  const botColor = game.userColor === 'w' ? 'b' : 'w';
  const arrows = shownHint ? [{ ...squares(shownHint), color: 'sky' as const }] : [];

  let actions;
  if (phase === 'busy') {
    actions = (
      <Button onClick={retryNow}>
        <RetryIcon />
        {t('play.game.busy.retry')}
      </Button>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <header className="flex min-h-20 flex-wrap items-center gap-3 px-4 tablet:px-8">
        <IconButton quiet label={t('play.game.close')} onClick={() => void navigate('/play')}>
          <CloseIcon />
        </IconButton>
        <h1 className="m-0 font-heading text-[20px] font-bold tablet:text-[24px]">
          {t('play.game.title', { name: bot.instrumental })}
        </h1>
        {game.learning && (
          <span className="rounded-pill bg-brand-tint px-3.5 py-1 text-[14px] font-extrabold text-brand-text">
            {t('play.game.learningChip')}
          </span>
        )}
        <Button
          variant="text"
          className="ml-auto"
          onClick={() => boardDispatch({ type: 'orientation/flip' })}
        >
          {t('play.game.flip')}
        </Button>
      </header>

      <main className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 pr-6 pb-10 laptop:grid-cols-[minmax(0,600px)_minmax(0,460px)] laptop:justify-center">
        <div className="flex flex-col gap-3">
          <Board
            state={board}
            dispatch={onBoardAction}
            disabled={!playing}
            arrows={arrows}
            lastMove={lastShown}
          />
          <p className="m-0 text-[14px] font-semibold text-text-muted">
            {t('play.game.boardNote')}
          </p>
          {networkFailed && <Banner>{t('play.game.moveError')}</Banner>}
        </div>

        <div className="flex flex-col gap-4">
          <section
            aria-label={bot.name}
            className="flex items-center gap-3 rounded-card border-2 border-line bg-surface p-3"
          >
            <BotAvatar kind={bot.kind} size={56} />
            <div className="flex flex-1 flex-col">
              <strong className="text-[18px]">{bot.name}</strong>
              <span className="text-[14px] font-semibold text-text-2">
                {t('play.game.opponent', { level: bot.level, color: colorName(botColor) })}
              </span>
            </div>
            <span
              role="status"
              aria-live="polite"
              className="rounded-pill bg-surface-2 px-3.5 py-1 text-[14px] font-extrabold"
            >
              {botStatus}
            </span>
          </section>

          <section
            aria-label={t('play.game.moves')}
            className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface p-3"
          >
            <h2 className="m-0 text-[15px] font-extrabold">{t('play.game.moves')}</h2>
            {pairs.length === 0 ? (
              <p className="m-0 text-[14px] font-semibold text-text-muted">
                {t('play.game.noMoves')}
              </p>
            ) : (
              <ol className="m-0 grid max-h-36 list-none grid-cols-2 gap-x-6 gap-y-1 overflow-y-auto p-0 text-[15px] font-semibold">
                {pairs.map((pair, index) => {
                  const lastPair = index === pairs.length - 1;
                  return (
                    <li key={pair.number} className="flex gap-2">
                      <span className="w-6 text-text-muted">{pair.number}.</span>
                      <span
                        className={`rounded px-1 ${lastPair && pair.black === null ? 'bg-brand-tint' : ''}`}
                      >
                        {pair.white}
                      </span>
                      {pair.black && (
                        <span className={`rounded px-1 ${lastPair ? 'bg-brand-tint' : ''}`}>
                          {pair.black}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <div className="flex items-end gap-3">
            <Mascot mood={message.mascot} size={88} dark={scheme === 'dark'} animate />
            <div className="flex-1">
              <ReplyCard
                tone={phase === 'busy' ? 'oops' : TONES[message.tone]}
                title={message.title}
                tail="down"
                actions={actions}
              >
                {message.text}
              </ReplyCard>
            </div>
          </div>

          {over ? (
            <Button large onClick={() => void playAgain()} disabled={creation.isLoading}>
              {t('play.game.over.again')}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              {game.learning && (
                <>
                  <Button
                    variant="secondary"
                    disabled={!canHint(session)}
                    onClick={() => void hint()}
                  >
                    <BulbIcon />
                    {t('play.game.hint')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!canUndo(session)}
                    onClick={() => void undo()}
                  >
                    <UndoIcon />
                    {t('play.game.undo')}
                  </Button>
                </>
              )}
              <Button
                variant="caution"
                className="ml-auto"
                onClick={() => dispatch({ type: 'game/resignAsked' })}
              >
                {t('play.game.resign')}
              </Button>
            </div>
          )}

          <section
            aria-label={t('play.game.you', { color: t(`play.game.colorCap.${game.userColor}`) })}
            className={`flex items-center gap-3 rounded-card border-2 p-3 ${learnerInCheck ? 'border-coral bg-coral-tint' : 'border-line bg-surface'}`}
          >
            <span
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-full border-2 border-edge bg-brand font-heading text-[20px] font-bold text-on-brand"
            >
              {initial}
            </span>
            <strong className="flex-1 text-[18px]">
              {t('play.game.you', { color: t(`play.game.colorCap.${game.userColor}`) })}
            </strong>
            {playerStatus && (
              <span
                className={`rounded-pill px-3.5 py-1 text-[14px] font-extrabold ${learnerInCheck ? 'text-coral-text' : 'bg-surface-2'}`}
              >
                {playerStatus}
              </span>
            )}
          </section>
        </div>
      </main>

      {session.resignOpen && (
        <ResignDialog
          message={coach.message({ type: 'GAME_RESIGN_ASK' })}
          dark={scheme === 'dark'}
          onStay={() => dispatch({ type: 'game/resignCancelled' })}
          onResign={() => void giveUp()}
        />
      )}
      {over && result && overOpen && (
        <GameOverDialog
          bot={bot}
          result={result}
          message={message}
          dark={scheme === 'dark'}
          onAgain={() => void playAgain()}
          onBots={() => void navigate('/play')}
          onClose={() => setOverOpen(false)}
        />
      )}
    </div>
  );
}
