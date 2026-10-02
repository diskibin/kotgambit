import { boardReducer, createBoardState, type BoardAction } from '@kotgambit/board-controller';
import { applyMove } from '@kotgambit/chess-core';
import { createCoach, type CoachMessage } from '@kotgambit/coach';
import type { Puzzle } from '@kotgambit/contracts';
import { puzzleMarks, ratingChange } from '@kotgambit/puzzle-player';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  usePuzzleGiveUpMutation,
  usePuzzleHintMutation,
  usePuzzleMoveMutation,
} from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { BulbIcon } from '../../shared/ui/icons';
import { IconButton } from '../../shared/ui/IconButton';
import { ReplyCard, type ReplyTone } from '../../shared/ui/ReplyCard';
import { useReducedMotion } from '../../shared/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, space, typography } from '../../theme/theme';
import { Board } from '../board/Board';
import { useBoardSize } from '../lessons/StepFrame';
import { Mascot } from '../mascot/Mascot';

const REPLY_DELAY_MS = 500;
const MAX_HINT_LEVEL = 3;
const SQUARE_END = 4;
const CAT = 56;
const TURN_MARKER = 28;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const squaresOf = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, SQUARE_END) });

const TONES: Record<CoachMessage['tone'], ReplyTone> = {
  neutral: 'neutral',
  success: 'success',
  oops: 'oops',
  hint: 'hint',
  demo: 'hint',
  celebrate: 'success',
  soft: 'info',
};

interface PuzzleSolverProps {
  puzzle: Puzzle;
  /** Asks the screen for the next puzzle. */
  onNext: () => void;
}

/**
 * One puzzle: the board and, under it, the cat's reply card. The learner moves, the server says whether the
 * move is the one, and the opponent's answer is played on the board. The line of the solution stays on the
 * server, the hints and the solution come from it step by step.
 */
export function PuzzleSolver({ puzzle, onNext }: PuzzleSolverProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const reduced = useReducedMotion();
  const boardSize = useBoardSize();
  const session = useAppSelector((state) => state.puzzleSession);
  const coach = useMemo(() => createCoach(), []);
  const [board, boardDispatch] = useReducer(boardReducer, undefined, () =>
    createBoardState({ fen: puzzle.fen, orientation: puzzle.solver }),
  );
  const [move] = usePuzzleMoveMutation();
  const [hint] = usePuzzleHintMutation();
  const [giveUp] = usePuzzleGiveUpMutation();
  const [busy, setBusy] = useState(false);
  const [networkFailed, setNetworkFailed] = useState(false);
  // The opponent's last move is what the board shows between the learner's moves
  const opponentMove = useRef(squaresOf(puzzle.lastMove));
  const [shown, setShown] = useState<{ from: string; to: string } | null>(() =>
    squaresOf(puzzle.lastMove),
  );
  // The position the learner looks at before their next move, where a refused move goes back to
  const restFen = useRef(puzzle.fen);

  useEffect(() => {
    dispatch({ type: 'puzzle/started', attemptId: puzzle.attemptId });
    return () => void dispatch({ type: 'puzzle/exited' });
  }, [dispatch, puzzle.attemptId]);

  const reset = () => {
    boardDispatch({ type: 'position/set', fen: restFen.current });
    setShown(opponentMove.current);
  };

  async function submit(uci: string, fenAfter: string) {
    setBusy(true);
    setNetworkFailed(false);
    setShown(null);
    const result = await move({ attemptId: puzzle.attemptId, move: uci });
    if ('error' in result) {
      setNetworkFailed(true);
      reset();
      setBusy(false);
      return;
    }
    const answer = result.data;
    if (answer.result === 'illegal') {
      reset();
    } else if (answer.result === 'wrong') {
      dispatch({ type: 'puzzle/moveWrong', mistakes: answer.mistakes, summary: answer.summary });
      reset();
    } else {
      restFen.current = fenAfter;
      dispatch({ type: 'puzzle/moveCorrect', solved: answer.solved, summary: answer.summary });
      if (answer.reply) {
        await wait(reduced ? 0 : REPLY_DELAY_MS);
        const reply = applyMove(fenAfter, answer.reply);
        if (reply.ok) {
          restFen.current = reply.fen;
          opponentMove.current = squaresOf(answer.reply);
          boardDispatch({ type: 'position/set', fen: reply.fen });
          setShown(opponentMove.current);
        }
      }
    }
    setBusy(false);
  }

  /**
   * Every press on the board goes through here. The reducer is pure, so the result of a press is known
   * before it is applied: when it is a move, the server is asked whether it is the one.
   */
  function onBoardAction(action: BoardAction) {
    const next = boardReducer(board, action);
    boardDispatch(action);
    if (next.lastMove && next.lastMove !== board.lastMove && !busy && session.phase === 'solving') {
      void submit(next.lastMove.uci, next.fen);
    }
  }

  async function askHint() {
    const result = await hint(puzzle.attemptId);
    if ('data' in result && result.data) {
      dispatch({ type: 'puzzle/hinted', hint: result.data });
    }
  }

  async function showSolution() {
    const result = await giveUp(puzzle.attemptId);
    if (!('data' in result) || !result.data) return;
    reset();
    dispatch({
      type: 'puzzle/gaveUp',
      solution: result.data.solution,
      summary: result.data.summary,
    });
  }

  const { phase, hint: activeHint, hintOpen, hintLevel } = session;
  const message = useMemo<CoachMessage>(() => {
    if (phase === 'correct') {
      return coach.message({ type: 'PUZZLE_SOLVED', streak: session.summary?.streak ?? 0 });
    }
    if (phase === 'wrong') return coach.message({ type: 'PUZZLE_WRONG' });
    if (phase === 'solution') return coach.message({ type: 'PUZZLE_SOLUTION' });
    if (hintOpen && activeHint) {
      return coach.message({
        type: 'PUZZLE_HINT',
        level: activeHint.level,
        ...(activeHint.level === 2
          ? { themes: activeHint.themes.map((theme) => theme.title) }
          : {}),
      });
    }
    return coach.message({ type: 'PUZZLE_START' });
    // A new mistake or a new hint asks for a new line of the cat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hintOpen, activeHint, session.mistakes, coach]);

  const marks = puzzleMarks(session);
  const change = ratingChange(session.summary);
  const frozen = busy || phase === 'wrong' || phase === 'correct' || phase === 'solution';

  let actions;
  if (phase === 'correct') {
    actions = <Button variant="success" large label={t('puzzles.solve.next')} onPress={onNext} />;
  } else if (phase === 'solution') {
    actions = <Button large label={t('puzzles.solve.next')} onPress={onNext} />;
  } else if (phase === 'wrong') {
    actions = (
      <>
        <Button
          variant="secondary"
          label={t('puzzles.solve.solution')}
          onPress={() => void showSolution()}
        />
        <Button
          label={t('puzzles.solve.again')}
          onPress={() => dispatch({ type: 'puzzle/retried' })}
        />
      </>
    );
  } else if (hintOpen && activeHint) {
    actions = (
      <>
        {activeHint.level < MAX_HINT_LEVEL && (
          <Button
            variant="secondary"
            label={t('puzzles.solve.moreHint')}
            onPress={() => void askHint()}
          />
        )}
        <Button
          label={t('puzzles.solve.understood')}
          onPress={() => dispatch({ type: 'puzzle/hintClosed' })}
        />
      </>
    );
  } else {
    actions = (
      <IconButton
        label={t('puzzles.solve.hint')}
        onPress={() => void askHint()}
        disabled={busy || hintLevel >= MAX_HINT_LEVEL}
      >
        <BulbIcon color={colors.text} />
      </IconButton>
    );
  }

  const note =
    phase === 'correct' && session.summary?.rated && change !== 0
      ? t('puzzles.solve.ratingChange', { change: change > 0 ? `+${change}` : `${change}` })
      : undefined;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: screenPadding,
        paddingBottom: insets.bottom + screenPadding,
        gap: space[3],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: TURN_MARKER,
            height: TURN_MARKER,
            borderRadius: radius.input / 2,
            borderWidth: 2,
            borderColor: colors.edge,
            backgroundColor: puzzle.solver === 'w' ? '#FFFFFF' : colors.edge,
          }}
        />
        <Text accessibilityRole="header" style={[typography.h1, { color: colors.text }]}>
          {t(`puzzles.turn.${puzzle.solver}`)}
        </Text>
      </View>

      <Board
        state={board}
        dispatch={onBoardAction}
        disabled={frozen}
        arrows={marks.arrows}
        hintSquares={marks.squares}
        lastMove={shown}
        size={boardSize}
      />
      {networkFailed && <Banner>{t('puzzles.solve.moveError')}</Banner>}

      <View style={{ paddingLeft: space[2] }}>
        <Mascot mood={message.mascot} size={CAT} dark={scheme === 'dark'} animate />
      </View>

      <ReplyCard
        tone={TONES[message.tone]}
        title={message.title}
        {...(note ? { note } : {})}
        actions={actions}
      >
        {message.text}
      </ReplyCard>

      <Text
        accessibilityLabel={`${t('puzzles.solve.hintsOf', { n: hintLevel })}. ${t('puzzles.solve.hintsNote')}`}
        style={[typography.small, { color: colors.textMuted }]}
      >
        {t('puzzles.solve.hintsOf', { n: hintLevel })} · {t('puzzles.solve.hintsNote')}
      </Text>
    </ScrollView>
  );
}
