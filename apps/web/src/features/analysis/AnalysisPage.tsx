import { AppShell } from '../../shared/ui/AppShell';
import { createBoardState } from '@kotgambit/board-controller';
import {
  editorReducer,
  fromFen,
  initialEditorState,
  canCastle,
  toFen,
  type CastlingRight,
  type EditorPiece,
} from '@kotgambit/analysis-editor';
import { positionProblem, type PieceType, type PlacedPiece } from '@kotgambit/chess-core';
import { describePositionProblem } from '@kotgambit/coach';
import { apiErrorOf } from '@kotgambit/contracts';
import { useMemo, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { useAnalyzePositionMutation, useEntitlementsQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { Tabs } from '../../shared/ui/Tabs';
import { Board } from '../board';
import { pieceUrl } from '../board/pieceAssets';
import { useUiPreferences } from '../settings/useUiPreferences';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { PremiumNudge } from '../premium/PremiumNudge';
import { AnalysisResult } from './AnalysisResult';

const PIECE_ORDER: readonly PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];
const RIGHTS: readonly CastlingRight[] = ['wK', 'wQ', 'bK', 'bQ'];
const HTTP_UNAVAILABLE = 503;

function statusOf(error: unknown): number | null {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : null;
}

/** The square to point at for a problem the learner can fix by putting a piece there. */
function hintSquaresFor(
  problem: ReturnType<typeof positionProblem>,
  pieces: PlacedPiece[],
): string[] {
  if (!problem) return [];
  if (problem.kind === 'no-king') {
    const square = problem.color === 'w' ? 'e1' : 'e8';
    return pieces.some((piece) => piece.square === square) ? [] : [square];
  }
  if (problem.kind === 'pawn-on-edge') return [problem.square];
  return [];
}

/** The position editor with the engine's look at the position under it. */
export function AnalysisPage() {
  const { t } = useTranslation();
  const scheme = useScheme();
  const { pieceSet } = useUiPreferences();
  const status = useAppSelector((state) => state.auth.status);
  const [editor, dispatch] = useReducer(editorReducer, undefined, initialEditorState);
  const [analyze, analysis] = useAnalyzePositionMutation();
  const entitlements = useEntitlementsQuery(undefined, { skip: status !== 'authenticated' });
  const [fenDraft, setFenDraft] = useState<string | null>(null);
  const [pasteFailed, setPasteFailed] = useState(false);
  // The position that was sent: a look at an older one says nothing about this one
  const [analyzedFen, setAnalyzedFen] = useState<string | null>(null);

  const fen = toFen(editor);
  const problem = useMemo(() => positionProblem(fen), [fen]);
  const pieces = useMemo<PlacedPiece[]>(
    () => Object.entries(editor.pieces).map(([square, piece]) => ({ square, ...piece })),
    [editor.pieces],
  );
  const boardState = useMemo(
    () => createBoardState({ fen, orientation: editor.orientation }),
    [fen, editor.orientation],
  );

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const current = analyzedFen === fen;
  const result = current ? analysis.data : undefined;
  const draftInvalid = fenDraft !== null && fromFen(fenDraft) === null;
  const failed = current && analysis.isError;
  const serverError = failed ? apiErrorOf(analysis.error) : null;
  const busy = failed && statusOf(analysis.error) === HTTP_UNAVAILABLE;
  // Premium has no limit, the server sends null then
  const { left, limit } = entitlements.data?.analysis ?? { left: null, limit: null };
  const limited = serverError?.code === 'analysis.limit' || left === 0;
  const arrows = result?.best
    ? [
        {
          from: result.best.uci.slice(0, 2),
          to: result.best.uci.slice(2, 4),
          color: 'mint' as const,
        },
      ]
    : [];

  function run() {
    setAnalyzedFen(fen);
    void analyze(fen);
  }

  async function paste() {
    setPasteFailed(false);
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (fromFen(text)) dispatch({ type: 'fen/loaded', fen: text });
      else setPasteFailed(true);
    } catch {
      // The browser refuses to read the clipboard without a permission or on an insecure page
      setPasteFailed(true);
    }
  }

  const toolIs = (piece: EditorPiece) =>
    editor.tool?.kind === 'piece' &&
    editor.tool.piece.color === piece.color &&
    editor.tool.piece.type === piece.type;

  return (
    <AppShell active="analysis" title={t('analysis.title')}>
      <div className="grid gap-8 laptop:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <section aria-label={t('analysis.title')} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div
              role="radiogroup"
              aria-label={t('analysis.editor.palette')}
              className="grid shrink-0 grid-cols-2 gap-2"
            >
              {(['w', 'b'] as const).flatMap((color) =>
                PIECE_ORDER.map((type) => {
                  const piece = { color, type };
                  const selected = toolIs(piece);
                  return (
                    <button
                      key={`${color}${type}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={t(`board.piece.${color}${type}`)}
                      onClick={() =>
                        dispatch({
                          type: 'tool/chosen',
                          tool: selected ? null : { kind: 'piece', piece },
                        })
                      }
                      className={`flex size-[52px] items-center justify-center rounded-control border-2 ${selected ? 'border-brand bg-brand-tint' : 'border-line bg-surface hover:bg-surface-2'}`}
                    >
                      <img src={pieceUrl(color, type, pieceSet)} alt="" className="size-10" />
                    </button>
                  );
                }),
              )}
              <button
                type="button"
                role="radio"
                aria-checked={editor.tool?.kind === 'eraser'}
                onClick={() =>
                  dispatch({
                    type: 'tool/chosen',
                    tool: editor.tool?.kind === 'eraser' ? null : { kind: 'eraser' },
                  })
                }
                className={`col-span-2 flex h-[52px] items-center justify-center rounded-control border-2 text-[15px] font-extrabold ${editor.tool?.kind === 'eraser' ? 'border-brand bg-brand-tint' : 'border-line bg-surface hover:bg-surface-2'}`}
              >
                {t('analysis.editor.eraser')}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <Board
                state={boardState}
                dispatch={() => undefined}
                pieces={pieces}
                onSquarePress={(square) => dispatch({ type: 'square/pressed', square })}
                hintSquares={hintSquaresFor(problem, pieces)}
                arrows={arrows}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => dispatch({ type: 'board/cleared' })}>
              {t('analysis.editor.clear')}
            </Button>
            <Button variant="secondary" onClick={() => dispatch({ type: 'board/reset' })}>
              {t('analysis.editor.start')}
            </Button>
            <Button variant="secondary" onClick={() => dispatch({ type: 'orientation/flipped' })}>
              {t('analysis.editor.flip')}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="fen" className="text-[14px] font-bold">
              {t('analysis.editor.fen')}
            </label>
            <div className="flex gap-3">
              <input
                id="fen"
                value={fenDraft ?? fen}
                spellCheck={false}
                aria-invalid={draftInvalid || problem !== null}
                onChange={(event) => {
                  setFenDraft(event.target.value);
                  if (fromFen(event.target.value)) {
                    dispatch({ type: 'fen/loaded', fen: event.target.value });
                  }
                }}
                onBlur={() => setFenDraft(null)}
                className={`h-12 min-w-0 flex-1 rounded-input border-2 px-3.5 font-mono text-[13px] ${draftInvalid || problem ? 'border-coral bg-coral-tint text-coral-text' : 'border-line bg-surface'}`}
              />
              <Button variant="secondary" onClick={() => void paste()}>
                {t('analysis.editor.paste')}
              </Button>
            </div>
            {(draftInvalid || pasteFailed) && (
              <p className="m-0 text-[14px] font-semibold text-coral-text">
                {pasteFailed ? t('analysis.editor.pasteFailed') : t('analysis.editor.fenInvalid')}
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-card border-2 border-line bg-surface p-4">
            <div className="flex flex-col gap-2">
              <span className="text-[15px] font-extrabold">{t('analysis.editor.turn')}</span>
              <Tabs
                label={t('analysis.editor.turn')}
                tabs={[
                  { id: 'w', label: t('analysis.editor.turnLabel.w') },
                  { id: 'b', label: t('analysis.editor.turnLabel.b') },
                ]}
                value={editor.turn}
                onChange={(turn) => dispatch({ type: 'turn/set', turn })}
              />
            </div>
            <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
              <legend className="mb-1 p-0 text-[15px] font-extrabold">
                {t('analysis.editor.castling')}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {RIGHTS.map((right) => {
                  const possible = canCastle(editor, right);
                  return (
                    <label
                      key={right}
                      className={`flex min-h-11 items-center gap-2 text-[15px] font-semibold ${possible ? '' : 'opacity-60'}`}
                    >
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={editor.castling[right] && possible}
                        disabled={!possible}
                        onChange={() => dispatch({ type: 'castling/toggled', right })}
                      />
                      {t(`analysis.editor.castlingLabel.${right}`)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {problem && (
            <div className="flex items-center gap-3 rounded-card border-2 border-coral-border bg-coral-tint p-3">
              <Mascot mood="oops" size={64} dark={scheme === 'dark'} />
              <div className="flex flex-col gap-1">
                <strong className="font-heading text-[18px] text-coral-text">
                  {t('analysis.invalid.title')}
                </strong>
                <span role="alert" className="text-[15px] font-semibold">
                  {describePositionProblem(problem)}
                </span>
              </div>
            </div>
          )}

          <Button large disabled={problem !== null || analysis.isLoading || limited} onClick={run}>
            {analysis.isLoading ? t('analysis.analyzing') : t('analysis.analyze')}
          </Button>
          {left !== null && limit !== null && (
            <p className="m-0 text-center text-[14px] font-semibold text-text-2">
              {t('analysis.attemptsLeft', { left, limit })}
            </p>
          )}

          {current && analysis.isLoading && (
            <div
              role="status"
              className="flex items-center gap-4 rounded-card border-2 border-line bg-surface p-4"
            >
              <Mascot mood="thinking" size={96} dark={scheme === 'dark'} animate />
              <div className="flex flex-col gap-1">
                <strong className="font-heading text-[18px]">{t('analysis.loading.title')}</strong>
                <span className="text-[15px] font-semibold text-text-2">
                  {t('analysis.loading.text')}
                </span>
              </div>
            </div>
          )}

          {limited && <PremiumNudge kind="analysis" compact />}
          {failed && !problem && !limited && (
            <div className="flex flex-col gap-3">
              <Banner>
                {busy
                  ? `${t('analysis.busy.title')}. ${t('analysis.busy.text')}`
                  : (serverError?.message ?? t('analysis.loadError'))}
              </Banner>
              {busy && (
                <Button className="self-start" onClick={run}>
                  {t('analysis.busy.retry')}
                </Button>
              )}
            </div>
          )}

          {result && !analysis.isLoading && <AnalysisResult analysis={result} />}
          {!result && !(current && analysis.isLoading) && !failed && (
            <p className="m-0 rounded-card border-2 border-dashed border-line p-6 text-center text-[16px] font-semibold text-text-muted">
              {t('analysis.placeholder')}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
