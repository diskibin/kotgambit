import { boardReducer, createBoardState, type BoardAction } from '@kotgambit/board-controller';
import { applyMove } from '@kotgambit/chess-core';
import { createCoach, type CoachMessage } from '@kotgambit/coach';
import { apiErrorOf, type BotProfile, type Game } from '@kotgambit/contracts';
import { boardFen, canHint, canUndo, lastMove, statusChip } from '@kotgambit/game-player';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useBotsQuery,
  useCreateGameMutation,
  useGameBotMoveMutation,
  useGameHintMutation,
  useGameMoveMutation,
  useGameQuery,
  useGameResignMutation,
  useGameUndoMutation,
  useLazyGameQuery,
  useMeQuery,
} from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { BulbIcon, CloseIcon } from '../../shared/ui/icons';
import { IconButton } from '../../shared/ui/IconButton';
import { ReplyCard, type ReplyTone } from '../../shared/ui/ReplyCard';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, space, typography } from '../../theme/theme';
import { Board } from '../board/Board';
import { useBoardSize } from '../lessons/StepFrame';
import { Mascot } from '../mascot/Mascot';
import { BotAvatar } from './BotAvatar';
import { MovesSheet, OverSheet, ResignSheet } from './GameSheets';

// The engine usually frees up within a few seconds, so the screen asks again by itself a few times
const BOT_RETRY_DELAY_MS = 3000;
const MAX_AUTO_RETRIES = 5;
const HTTP_CONFLICT = 409;
const HEADER_AVATAR = 40;
const PLAYER_AVATAR = 40;
const CAT = 52;
const RECENT_MOVES = 3;

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
  id: string;
  onClose: () => void;
  onNewGame: (gameId: string) => void;
}

/** Reads the game from the server and hands it to the screen. */
export function GameScreen({ id, onClose, onNewGame }: GameScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const loaded = useAppSelector((state) => state.gameSession.game);
  // A game that was left and opened again is read afresh, the cached copy may be behind
  const game = useGameQuery(id, { refetchOnMountOrArgChange: true });
  const bots = useBotsQuery();

  useEffect(() => {
    if (game.data && loaded?.id !== game.data.id) {
      dispatch({ type: 'game/loaded', game: game.data });
    }
  }, [game.data, loaded?.id, dispatch]);

  useEffect(() => () => void dispatch({ type: 'game/exited' }), [dispatch]);

  const bot = bots.data?.bots.find((candidate) => candidate.id === loaded?.botId);
  if (loaded?.id === id && bot)
    return <GamePlay bot={bot} onClose={onClose} onNewGame={onNewGame} />;

  const failed = game.isError || bots.isError;
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[4],
        padding: screenPadding,
        paddingTop: insets.top + screenPadding,
        backgroundColor: colors.bg,
      }}
    >
      <Text
        accessibilityRole={failed ? 'header' : 'progressbar'}
        style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
      >
        {failed ? (apiErrorOf(game.error)?.message ?? t('play.loadError')) : t('play.loading')}
      </Text>
      {failed && (
        <>
          <Button variant="secondary" label={t('play.game.close')} onPress={onClose} />
          <Button
            label={t('play.retry')}
            onPress={() => {
              void game.refetch();
              void bots.refetch();
            }}
          />
        </>
      )}
    </View>
  );
}

/**
 * One game against a bot: the board, the last moves and the cat's reply card. The server decides what is
 * legal and what the bot plays, the screen only shows the answer. When the engine is busy the position
 * is kept and the bot's move is asked for again.
 */
function GamePlay({
  bot,
  onClose,
  onNewGame,
}: {
  bot: BotProfile;
  onClose: () => void;
  onNewGame: (gameId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const boardSize = useBoardSize();
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
  const [movesOpen, setMovesOpen] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const retries = useRef(0);

  const fen = boardFen(session) ?? game.fen;
  useEffect(() => {
    if (board.fen !== fen) boardDispatch({ type: 'position/set', fen });
  }, [fen, board.fen]);

  const { phase, hint: shownHint, resignOpen } = session;
  const over = phase === 'over';

  // The system Back button asks before giving up, like the arrow in the header
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (movesOpen) setMovesOpen(false);
      else if (resignOpen) dispatch({ type: 'game/resignCancelled' });
      else if (over) onClose();
      else dispatch({ type: 'game/resignAsked' });
      return true;
    });
    return () => subscription.remove();
  }, [movesOpen, resignOpen, over, dispatch, onClose]);

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
    if (next.lastMove && next.lastMove !== board.lastMove && phase === 'playing') {
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
    if (phase !== 'busy') {
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
  }, [phase, retryTick]);

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
    if ('data' in result && result.data) onNewGame(result.data.id);
    else onClose();
  }

  const result = game.result;
  const promoting = board.pendingPromotion !== null;
  const botGender = { name: bot.name, gender: bot.gender };
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
  const learnerInCheck = chip === 'check';
  const playing = phase === 'playing';
  const recent = game.moves.slice(-RECENT_MOVES);
  const initial = (me.data?.displayName ?? me.data?.email ?? '?').charAt(0).toUpperCase();

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

  const botColor = game.userColor === 'w' ? 'b' : 'w';
  const arrows = shownHint ? [{ ...squares(shownHint), color: 'sky' as const }] : [];
  const youLabel = t('play.game.you', { color: t(`play.game.colorCap.${game.userColor}`) });

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: screenPadding,
          paddingTop: insets.top + space[2],
          paddingBottom: insets.bottom + screenPadding,
          gap: space[3],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <IconButton
            quiet
            label={t('play.game.close')}
            onPress={() => (over ? onClose() : dispatch({ type: 'game/resignAsked' }))}
          >
            <CloseIcon color={colors.text} />
          </IconButton>
          <BotAvatar kind={bot.kind} size={HEADER_AVATAR} />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>
              {bot.name}
            </Text>
            <Text style={[typography.small, { color: colors.text2 }]}>
              {t('play.game.opponent', {
                level: bot.level,
                color: t(`play.game.colorBy.${botColor}`),
              })}
            </Text>
          </View>
          <View
            accessibilityLiveRegion="polite"
            style={{
              borderRadius: radius.pill,
              backgroundColor: colors.surface2,
              paddingHorizontal: space[3],
              paddingVertical: space[1],
            }}
          >
            <Text style={[typography.small, { color: colors.text }]}>{botStatus}</Text>
          </View>
        </View>

        <Board
          state={board}
          dispatch={onBoardAction}
          disabled={!playing}
          arrows={arrows}
          lastMove={lastMove(session)}
          size={boardSize}
        />
        {networkFailed && <Banner>{t('play.game.moveError')}</Banner>}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
            {recent.map((move, index) => {
              const current = index === recent.length - 1;
              return (
                <View
                  key={`${game.moves.length - recent.length + index}-${move.uci}`}
                  style={{
                    borderRadius: radius.pill,
                    backgroundColor: current ? colors.brandTint : colors.surface2,
                    paddingHorizontal: space[3],
                    paddingVertical: space[1],
                  }}
                >
                  <Text
                    style={[typography.small, { color: current ? colors.brandText : colors.text }]}
                  >
                    {move.san}
                  </Text>
                </View>
              );
            })}
          </View>
          <Button
            variant="text"
            label={t('play.game.allMoves')}
            onPress={() => setMovesOpen(true)}
          />
        </View>

        <View style={{ paddingLeft: space[2] }}>
          <Mascot mood={message.mascot} size={CAT} dark={scheme === 'dark'} animate />
        </View>
        <ReplyCard
          tone={phase === 'busy' ? 'oops' : TONES[message.tone]}
          title={message.title}
          actions={
            phase === 'busy' ? (
              <Button label={t('play.game.busy.retry')} onPress={retryNow} />
            ) : undefined
          }
        >
          {message.text}
        </ReplyCard>

        <View
          accessible
          accessibilityLabel={`${youLabel}${playerStatus ? `. ${playerStatus}` : ''}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[2],
            borderRadius: radius.card,
            borderWidth: 2,
            borderColor: learnerInCheck ? colors.coral : colors.line,
            backgroundColor: learnerInCheck ? colors.coralTint : colors.surface,
          }}
        >
          <View
            style={{
              width: PLAYER_AVATAR,
              height: PLAYER_AVATAR,
              borderRadius: PLAYER_AVATAR,
              borderWidth: 2,
              borderColor: colors.edge,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[typography.h3, { color: colors.onBrand }]}>{initial}</Text>
          </View>
          <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{youLabel}</Text>
          {playerStatus && (
            <Text
              style={[
                typography.small,
                { color: learnerInCheck ? colors.coralText : colors.text2 },
              ]}
            >
              {playerStatus}
            </Text>
          )}
        </View>

        {over ? (
          <Button
            large
            label={t('play.game.over.again')}
            busy={creation.isLoading}
            onPress={() => void playAgain()}
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {game.learning && (
              <>
                <Button
                  variant="secondary"
                  icon={<BulbIcon color={colors.text} />}
                  label={t('play.game.hint')}
                  disabled={!canHint(session)}
                  onPress={() => void hint()}
                />
                <Button
                  variant="secondary"
                  label={t('play.game.undo')}
                  disabled={!canUndo(session)}
                  onPress={() => void undo()}
                />
              </>
            )}
            <Button
              variant="caution"
              label={t('play.game.resign')}
              onPress={() => dispatch({ type: 'game/resignAsked' })}
            />
          </View>
        )}
      </ScrollView>

      {resignOpen && (
        <ResignSheet
          message={coach.message({ type: 'GAME_RESIGN_ASK' })}
          onStay={() => dispatch({ type: 'game/resignCancelled' })}
          onResign={() => void giveUp()}
        />
      )}
      {movesOpen && <MovesSheet game={game} onClose={() => setMovesOpen(false)} />}
      {over && result && overOpen && (
        <OverSheet
          bot={bot}
          result={result}
          message={message}
          onAgain={() => void playAgain()}
          onBots={onClose}
          onClose={() => setOverOpen(false)}
        />
      )}
    </>
  );
}
