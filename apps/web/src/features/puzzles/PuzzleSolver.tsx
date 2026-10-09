import { boardReducer, createBoardState, type BoardAction } from '@kotgambit/board-controller';
import { applyMove } from '@kotgambit/chess-core';
import { createCoach, type CoachMessage } from '@kotgambit/coach';
import type { Puzzle } from '@kotgambit/contracts';
import { puzzleMarks, ratingChange } from '@kotgambit/puzzle-player';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  usePuzzleGiveUpMutation,
  usePuzzleHintMutation,
  usePuzzleMoveMutation,
} from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useNavLayout } from '../../shared/useNavLayout';
import { useReducedMotion } from '../../shared/useReducedMotion';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { BulbIcon } from '../../shared/ui/icons';
import { ReplyCard, type ReplyTone } from '../../shared/ui/ReplyCard';
import { BoardSlot } from '../../shared/ui/BoardSlot';
import { Board } from '../board';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

const REPLY_DELAY_MS = 500;
const HINT_LEVELS = [1, 2, 3] as const;
const MAX_HINT_LEVEL = 3;
const SQUARE_END = 4;

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
 * One puzzle: the board and the cat's reply card. The learner moves, the server says whether the move is
 * the one, and the opponent's answer is played on the board. The line of the solution is only ever in the
 * server's hands, the hints and the solution come from it step by step.
 */
export function PuzzleSolver({ puzzle, onNext }: PuzzleSolverProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const scheme = useScheme();
  // On a phone the cat under the board is small (web/screens/layout.md) so that the hints fit beside it
  const phone = useNavLayout() === 'bottom';
  const reduced = useReducedMotion();
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
    actions = (
      <Button variant="success" large onClick={onNext} data-autofocus>
        {t('puzzles.solve.next')}
      </Button>
    );
  } else if (phase === 'solution') {
    actions = (
      <Button large onClick={onNext} data-autofocus>
        {t('puzzles.solve.next')}
      </Button>
    );
  } else if (phase === 'wrong') {
    actions = (
      <>
        <Button variant="secondary" onClick={() => void showSolution()}>
          {t('puzzles.solve.showSolution')}
        </Button>
        <Button onClick={() => dispatch({ type: 'puzzle/retried' })} data-autofocus>
          {t('puzzles.solve.again')}
        </Button>
      </>
    );
  } else if (hintOpen && activeHint) {
    actions = (
      <>
        {activeHint.level < MAX_HINT_LEVEL && (
          <Button variant="secondary" onClick={() => void askHint()}>
            {t('puzzles.solve.moreHint')}
          </Button>
        )}
        <Button onClick={() => dispatch({ type: 'puzzle/hintClosed' })} data-autofocus>
          {t('puzzles.solve.understood')}
        </Button>
      </>
    );
  } else {
    actions = (
      <IconButton
        label={t('puzzles.solve.hint')}
        onClick={() => void askHint()}
        disabled={busy || hintLevel >= MAX_HINT_LEVEL}
      >
        <BulbIcon />
      </IconButton>
    );
  }

  const note =
    phase === 'correct' && session.summary?.rated && change !== 0
      ? t('puzzles.solve.ratingChange', { change: change > 0 ? `+${change}` : `${change}` })
      : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-3 px-4 pr-6 pb-4 max-tablet:flex max-tablet:flex-1 max-tablet:flex-col tablet:gap-8 tablet:pb-10 laptop:grid-cols-[minmax(0,560px)_minmax(0,460px)] laptop:justify-center">
      <div className="flex flex-col gap-3">
        <BoardSlot>
          <Board
            state={board}
            dispatch={onBoardAction}
            disabled={frozen}
            arrows={marks.arrows}
            hintSquares={marks.squares}
            lastMove={shown}
          />
        </BoardSlot>
        <p className="m-0 hidden text-[14px] font-semibold text-text-muted tablet:block">
          {t('puzzles.solve.boardNote')}
        </p>
        {networkFailed && <Banner>{t('puzzles.solve.moveError')}</Banner>}
      </div>

      <div className="flex flex-col gap-3 tablet:gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`size-8 rounded-[8px] border-2 border-edge ${puzzle.solver === 'w' ? 'bg-white' : 'bg-ink'}`}
          />
          <h1 className="m-0 font-heading text-[18px] leading-6 font-bold tablet:text-[26px] tablet:leading-9 laptop:text-[31px] laptop:leading-10">
            {t(`puzzles.turn.${puzzle.solver}`)}
          </h1>
        </div>

        <ReplyCard
          tone={TONES[message.tone]}
          title={message.title}
          {...(note ? { note } : {})}
          actions={actions}
        >
          {message.text}
        </ReplyCard>

        <div className="flex items-end gap-3 tablet:gap-4 tablet:pl-4">
          <Mascot mood={message.mascot} size={phone ? 60 : 130} dark={scheme === 'dark'} animate />
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-card border-2 border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span className="text-[15px] font-extrabold">
                {t('puzzles.solve.hintsOf', { n: hintLevel })}
              </span>
              <span aria-hidden="true" className="flex gap-1.5">
                {HINT_LEVELS.map((level) => (
                  <span
                    key={level}
                    className={`h-2.5 w-8 rounded-pill border-2 border-edge ${hintLevel >= level ? 'bg-sky' : 'bg-surface-2'}`}
                  />
                ))}
              </span>
            </div>
            <span className="hidden text-[13px] font-semibold text-text-muted tablet:inline">
              {t('puzzles.solve.hintsNote')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
