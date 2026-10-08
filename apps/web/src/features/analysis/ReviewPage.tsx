import { AppShell } from '../../shared/ui/AppShell';
import { createBoardState } from '@kotgambit/board-controller';
import { STARTING_FEN, playGame, winPercent } from '@kotgambit/chess-core';
import type { Game, GameReview, KeyMoment } from '@kotgambit/contracts';
import {
  QUALITY_MARKS,
  chancesGraph,
  graphPath,
  lastMoveNumber,
  type Quality,
} from '@kotgambit/game-player';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import {
  useBotsQuery,
  useGameQuery,
  useMakeCardsMutation,
  useReviewQuery,
  useStartReviewMutation,
} from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { Board } from '../board';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { formatEval } from './formatEval';

const POLL_MS = 1500;
const GRAPH_WIDTH = 440;
const GRAPH_HEIGHT = 170;
// The room on the left for the numbers of the scale, and a little on the right so that the last point is not cut
const SCALE_WIDTH = 34;
// A row of small squares under the plot, one for every move, colored by how good the move was
const STRIP_BAND = 16;
const STRIP_SIZE = 9;
// The bands above and below the plot, for the words about who is winning: they do not take room from the plot
const LABEL_BAND = 24;
const GRAPH_RIGHT = 8;
// The marks of the scale, in pawns for White: the numbers of the evaluation under the board
const SCALE_PAWNS = [4, 2, 0, -2, -4] as const;
const CENTIPAWNS = 100;
const PERCENT = 100;
const MINUS = '−';
// The color of a quality is the same on the board, under the graph and in the list: green is good, yellow is a
// slip, coral is a mistake and a darker coral a blunder. The mark is written in too, so that color is not alone
const QUALITY_TONE: Record<Quality, { bg: string; fill: string; text: string }> = {
  best: { bg: 'bg-mint', fill: 'fill-mint', text: 'text-on-accent' },
  good: { bg: 'bg-sky', fill: 'fill-sky', text: 'text-on-accent' },
  inaccuracy: { bg: 'bg-sun', fill: 'fill-sun', text: 'text-on-accent' },
  mistake: { bg: 'bg-coral', fill: 'fill-coral', text: 'text-on-accent' },
  blunder: { bg: 'bg-coral-depth', fill: 'fill-coral-depth', text: 'text-white' },
};
const QUALITIES: readonly Quality[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'];

function Ring({ label, value, name }: { label: string; value: number | null; name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-card border-2 border-line bg-surface p-3">
      <span className="font-heading text-[26px] font-bold">
        {value === null ? '—' : `${value}%`}
      </span>
      <span className="text-[13px] font-bold text-text-2">{label}</span>
      <span className="sr-only">{name}</span>
    </div>
  );
}

function Graph({
  review,
  current,
  onPick,
}: {
  review: GameReview;
  /** The position shown on the board: the line stands on it. */
  current: number;
  /** A click on the graph: the half-move it is over, 0 for the start. */
  onPick: (ply: number) => void;
}) {
  const { t } = useTranslation();
  const points = chancesGraph(review.chances, GRAPH_WIDTH, GRAPH_HEIGHT);
  const marker = points[Math.min(current, points.length - 1)];
  const viewWidth = SCALE_WIDTH + GRAPH_WIDTH + GRAPH_RIGHT;
  // The line is the chance of White to win, so the scale is drawn where those pawns put the line: the same
  // numbers that the review writes under the board, at the heights where the line stands for them
  const yOfPawns = (pawns: number) =>
    GRAPH_HEIGHT - (winPercent({ kind: 'cp', value: pawns * CENTIPAWNS }) / PERCENT) * GRAPH_HEIGHT;
  return (
    <svg
      role="img"
      aria-label={t('review.result.graphLabel')}
      viewBox={`0 0 ${viewWidth} ${GRAPH_HEIGHT + STRIP_BAND + LABEL_BAND * 2}`}
      className="h-auto w-full cursor-pointer rounded-card border-2 border-line bg-surface"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        if (box.width === 0) return;
        // The click is in the units of the picture, the scale on the left is not a part of the game
        const x = ((event.clientX - box.left) / box.width) * viewWidth - SCALE_WIDTH;
        const index = Math.round((x / GRAPH_WIDTH) * (points.length - 1));
        onPick(Math.max(0, Math.min(points.length - 1, index)));
      }}
    >
      <text x={SCALE_WIDTH + 6} y={LABEL_BAND - 8} className="fill-text-2 text-[12px] font-bold">
        {t('review.result.graphWhite')}
      </text>
      <text
        x={SCALE_WIDTH + 6}
        y={LABEL_BAND + GRAPH_HEIGHT + STRIP_BAND + 16}
        className="fill-text-2 text-[12px] font-bold"
      >
        {t('review.result.graphBlack')}
      </text>
      <g transform={`translate(0 ${LABEL_BAND})`}>
        {SCALE_PAWNS.map((pawns) => (
          <g key={pawns}>
            <line
              x1={SCALE_WIDTH}
              x2={SCALE_WIDTH + GRAPH_WIDTH}
              y1={yOfPawns(pawns)}
              y2={yOfPawns(pawns)}
              className={pawns === 0 ? 'stroke-text-muted' : 'stroke-line'}
              strokeDasharray={pawns === 0 ? undefined : '4 4'}
            />
            <text
              x={SCALE_WIDTH - 6}
              y={yOfPawns(pawns) + 4}
              textAnchor="end"
              className="fill-text-2 text-[11px] font-bold"
            >
              {pawns > 0 ? `+${pawns}` : pawns < 0 ? `${MINUS}${Math.abs(pawns)}` : '0'}
            </text>
          </g>
        ))}
        <g transform={`translate(${SCALE_WIDTH} 0)`}>
          <path
            d={graphPath(points)}
            fill="none"
            className="stroke-brand"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {review.qualities.map((quality, index) => {
            const point = points[index + 1];
            if (!point) return null;
            const gap = GRAPH_WIDTH / Math.max(1, review.qualities.length);
            const size = Math.max(2, Math.min(STRIP_SIZE, gap - 1.5));
            return (
              <rect
                key={index}
                data-quality={quality}
                x={point.x - size / 2}
                y={GRAPH_HEIGHT + 5}
                width={size}
                height={STRIP_SIZE}
                rx="2"
                className={`${QUALITY_TONE[quality].fill} ${index + 1 === current ? 'stroke-edge' : 'stroke-transparent'}`}
                strokeWidth="2"
              />
            );
          })}
          {marker && (
            <line
              x1={marker.x}
              x2={marker.x}
              y1="0"
              y2={GRAPH_HEIGHT}
              className="stroke-edge"
              strokeWidth="2"
            />
          )}
        </g>
      </g>
    </svg>
  );
}

/** The review of a game, read again every moment until the server says it is done or failed. */
function useReviewPolling(id: string, ready: boolean) {
  const [interval, setIntervalMs] = useState(POLL_MS);
  const review = useReviewQuery(id, { skip: !ready, pollingInterval: interval });
  const finished = review.data?.status === 'done' || review.data?.status === 'failed';
  const wanted = finished ? 0 : POLL_MS;
  // Starting a failed review again makes the status pending, and the polling starts again with it
  if (wanted !== interval) setIntervalMs(wanted);
  return review;
}

function momentTitle(moment: KeyMoment, t: TFunction): string {
  return t(moment.color === 'w' ? 'review.result.moveOf' : 'review.result.moveOfBlack', {
    number: moment.moveNumber,
    san: moment.played.san,
  });
}

function outcomeLine(game: Game, t: TFunction): string {
  const result = game.result;
  if (!result) return '';
  const n = lastMoveNumber(game.moves.length);
  const moves =
    result.reason === 'checkmate'
      ? t('review.result.mateAt', { n })
      : result.reason === 'resignation'
        ? t('review.result.resigned', { n })
        : t('review.result.drawAt', { n });
  return t(`review.result.outcome.${result.outcome}`, { moves });
}

/** The look back at a finished game: the board at the key moments, the accuracy, the graph and the moments. */
export function ReviewPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const scheme = useScheme();
  const authStatus = useAppSelector((state) => state.auth.status);
  const signedIn = authStatus === 'authenticated';
  const game = useGameQuery(id, { skip: !signedIn });
  const bots = useBotsQuery(undefined, { skip: !signedIn });
  const [startReview] = useStartReviewMutation();
  const [makeCards, cards] = useMakeCardsMutation();
  const started = useRef(false);
  const ready = signedIn && game.data?.status === 'finished';
  const review = useReviewPolling(id, ready);
  const [ply, setPly] = useState<number | null>(null);

  // Asking twice is fine for the server, but there is no reason to ask more than once per screen
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void startReview(id);
  }, [ready, id, startReview]);

  const moves = useMemo(() => game.data?.moves ?? [], [game.data]);
  const current = ply ?? moves.length;
  // The move that was just played on the board is the one that is looked at: the arrows, the buttons, the graph
  // and the list of moments all move the same thing, so they never disagree
  const focus = current >= 1 ? current : null;
  const fen = useMemo(
    () => playGame(moves.slice(0, current).map((move) => move.uci))?.fen ?? STARTING_FEN,
    [moves, current],
  );
  const boardState = useMemo(
    () => createBoardState({ fen, orientation: game.data?.userColor ?? 'w' }),
    [fen, game.data?.userColor],
  );

  if (authStatus === 'anonymous') return <Navigate to="/login" replace />;

  const bot = bots.data?.bots.find((candidate) => candidate.id === game.data?.botId);
  const data = review.data;
  const result = data?.review ?? null;

  function retry() {
    void startReview(id);
  }

  if (game.isError || review.isError) {
    return (
      <AppShell active="play" title={t('review.title')}>
        <Banner>{t('review.loadError')}</Banner>
      </AppShell>
    );
  }
  if (!data || (data.status !== 'done' && data.status !== 'failed')) {
    return (
      <AppShell active="play" title={t('review.title')}>
        <div
          role="status"
          className="mx-auto flex max-w-[480px] flex-col items-center gap-4 rounded-card border-2 border-edge bg-surface p-8 text-center shadow-shashka"
        >
          <Mascot mood="thinking" size={140} dark={scheme === 'dark'} animate />
          <h2 className="m-0 font-heading text-[22px] font-bold">{t('review.loading.title')}</h2>
          <p className="m-0 text-[16px] font-semibold text-text-2">{t('review.loading.text')}</p>
          {data && (
            <ProgressBar
              value={data.done}
              max={data.total}
              label={t('review.loading.progress', { done: data.done, total: data.total })}
            />
          )}
        </div>
      </AppShell>
    );
  }
  if (data.status === 'failed' || !result) {
    return (
      <AppShell active="play" title={t('review.title')}>
        <div className="mx-auto flex max-w-[480px] flex-col items-center gap-4 text-center">
          <Mascot mood="oops" size={140} dark={scheme === 'dark'} />
          <h2 className="m-0 font-heading text-[22px] font-bold">{t('review.failed.title')}</h2>
          <p className="m-0 text-[16px] font-semibold text-text-2">{t('review.failed.text')}</p>
          <Button onClick={retry}>{t('review.failed.retry')}</Button>
        </div>
      </AppShell>
    );
  }

  const focused = focus !== null ? (moves[focus - 1] ?? null) : null;
  const moment = focus !== null ? result.keyMoments.find((item) => item.ply === focus) : undefined;
  // The best move is Premium's for every half-move, the key moment brings its own for the ones it points at
  const better = (focus !== null ? result.best?.[focus - 1] : null) ?? moment?.better ?? null;
  const focusQuality = focus !== null ? result.qualities[focus - 1] : undefined;
  const evalBefore = focus !== null ? result.evals?.[focus - 1] : undefined;
  const evalAfter = focus !== null ? result.evals?.[focus] : undefined;
  const arrows =
    focused && focus !== null
      ? [
          {
            from: focused.uci.slice(0, 2),
            to: focused.uci.slice(2, 4),
            color: 'sun' as const,
          },
          ...(better && better.uci !== focused.uci
            ? [
                {
                  from: better.uci.slice(0, 2),
                  to: better.uci.slice(2, 4),
                  color: 'mint' as const,
                },
              ]
            : []),
        ]
      : [];
  const pick = (index: number) => setPly(index);
  const total = moves.length;

  return (
    <AppShell active="play" title={t('review.title')}>
      <div className="grid gap-8 laptop:grid-cols-[minmax(440px,1fr)_minmax(0,2fr)]">
        <section className="flex flex-col gap-3">
          {game.data && bot && (
            <div className="flex flex-col">
              <strong className="text-[18px]">
                {t('review.result.withBot', { name: bot.name })}
              </strong>
              <span className="text-[15px] font-semibold text-text-2">
                {outcomeLine(game.data, t)}
              </span>
            </div>
          )}
          <Board
            state={boardState}
            dispatch={() => undefined}
            disabled
            arrows={arrows}
            badges={
              focused && focusQuality
                ? [
                    {
                      square: focused.uci.slice(2, 4),
                      text: QUALITY_MARKS[focusQuality],
                      label: t(`review.result.qualityOne.${focusQuality}`),
                      className: `${QUALITY_TONE[focusQuality].bg} ${QUALITY_TONE[focusQuality].text}`,
                    },
                  ]
                : []
            }
          />
          {focused && focus !== null && (
            <section
              aria-label={t('review.result.moveInfo')}
              className="flex flex-col gap-1 rounded-card border-2 border-line bg-surface p-3"
            >
              <strong className="text-[16px]">
                {t(focus % 2 === 1 ? 'review.result.moveOf' : 'review.result.moveOfBlack', {
                  number: Math.ceil(focus / 2),
                  san: focused.san,
                })}
                <span className="font-semibold text-text-2">
                  {' · '}
                  {t(
                    (focus % 2 === 1 ? 'w' : 'b') === (game.data?.userColor ?? 'w')
                      ? 'review.result.yourMove'
                      : 'review.result.theirMove',
                  )}
                </span>
              </strong>
              {focusQuality && (
                <span
                  className={`self-start rounded-pill px-3 py-0.5 text-[14px] font-extrabold ${QUALITY_TONE[focusQuality].bg} ${QUALITY_TONE[focusQuality].text}`}
                >
                  {QUALITY_MARKS[focusQuality]} {t(`review.result.qualityOne.${focusQuality}`)}
                </span>
              )}
              {evalBefore && evalAfter && (
                <span className="text-[15px] font-semibold">
                  {t('review.result.evalChange', {
                    before: formatEval(evalBefore, t),
                    after: formatEval(evalAfter, t),
                  })}
                </span>
              )}
              {better &&
                (better.uci === focused.uci ? (
                  <span className="text-[15px] font-semibold text-mint-text">
                    {t('review.result.wasBest')}
                  </span>
                ) : (
                  <span className="text-[15px] font-semibold">
                    {t('review.result.better', { san: better.san })}
                  </span>
                ))}
              {moment && (
                <span className="text-[14px] font-semibold text-text-2">{moment.explanation}</span>
              )}
              {result.evals && (
                <span className="text-[13px] font-semibold text-text-muted">
                  {t('review.result.evalHint')}
                </span>
              )}
            </section>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              aria-label={t('review.result.start')}
              onClick={() => {
                setPly(0);
              }}
            >
              «
            </Button>
            <Button
              variant="secondary"
              aria-label={t('review.result.previous')}
              disabled={current === 0}
              onClick={() => {
                setPly(Math.max(0, current - 1));
              }}
            >
              ‹
            </Button>
            <span className="text-[15px] font-bold">
              {t('review.result.step', { n: current, total })}
            </span>
            <Button
              variant="secondary"
              aria-label={t('review.result.next')}
              disabled={current === total}
              onClick={() => {
                setPly(Math.min(total, current + 1));
              }}
            >
              ›
            </Button>
            <Button
              variant="secondary"
              aria-label={t('review.result.end')}
              onClick={() => {
                setPly(total);
              }}
            >
              »
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="m-0 text-[16px] font-extrabold">{t('review.result.graph')}</h2>
            <p className="m-0 text-[13px] font-semibold text-text-2">
              {t('review.result.graphHint')}
            </p>
            <Graph review={result} current={current} onPick={pick} />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="m-0 text-[16px] font-extrabold">{t('review.result.quality')}</h2>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {QUALITIES.filter(
                (quality) => quality !== 'inaccuracy' || result.counts.inaccuracy > 0,
              ).map((quality) => (
                <li
                  key={quality}
                  className={`rounded-pill px-3.5 py-1 text-[14px] font-bold ${QUALITY_TONE[quality].bg} ${QUALITY_TONE[quality].text}`}
                >
                  {QUALITY_MARKS[quality]} {result.counts[quality]}{' '}
                  {t(`review.result.quality_${quality}`)}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <Ring
              label={t('review.result.you')}
              name={t('review.result.accuracy')}
              value={result.accuracy.player}
            />
            <Ring
              label={bot?.name ?? ''}
              name={t('review.result.accuracy')}
              value={result.accuracy.bot}
            />
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="m-0 text-[16px] font-extrabold">{t('review.result.moments')}</h2>
            {result.keyMoments.length === 0 && (
              <p className="m-0 text-[15px] font-semibold text-text-2">
                {t('review.result.noMoments')}
              </p>
            )}
            {result.keyMoments.map((moment) => {
              const bad = moment.kind !== 'highlight';
              return (
                <article
                  key={moment.ply}
                  className={`flex items-center gap-3 rounded-card border-2 p-3 ${bad ? 'border-coral-border bg-coral-tint' : 'border-mint-border bg-mint-tint'}`}
                >
                  <span className="rounded-pill bg-surface px-3 py-1 text-[14px] font-extrabold">
                    {QUALITY_MARKS[moment.kind === 'highlight' ? 'best' : moment.kind]}
                  </span>
                  <div className="flex flex-1 flex-col">
                    <strong className="text-[16px]">{momentTitle(moment, t)}</strong>
                    <span className="text-[14px] font-semibold">{moment.explanation}</span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      pick(moment.ply);
                    }}
                  >
                    {t('review.result.show')}
                  </Button>
                </article>
              );
            })}
          </div>

          {!data.full && (
            <div className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-sun-depth bg-sun-tint p-4 text-center">
              <Mascot mood="proud" size={72} dark={scheme === 'dark'} />
              <span className="rounded-pill border-2 border-edge bg-sun px-3 py-0.5 text-[13px] font-extrabold text-on-accent">
                {t('limits.review.chip')}
              </span>
              <strong className="font-heading text-[18px]">{t('limits.review.title')}</strong>
              <span className="text-[15px] font-semibold text-text-2">
                {t('limits.review.text')}
              </span>
              <Button variant="premium" onClick={() => void navigate('/premium')}>
                {t('limits.review.cta')}
              </Button>
            </div>
          )}

          {data.full && result.mistakes.length > 0 && (
            <div className="flex flex-col gap-3 rounded-card border-2 border-dashed border-line p-4">
              <Button
                variant="secondary"
                disabled={cards.isLoading}
                onClick={() => void makeCards(id)}
              >
                {t('review.makeCards.button')}
              </Button>
              {cards.data && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[15px] font-semibold">
                    {cards.data.created === 0
                      ? t('review.makeCards.already')
                      : t('review.makeCards.created', { count: cards.data.created })}
                  </span>
                  <Button onClick={() => void navigate('/cards')}>
                    {t('review.makeCards.practice')}
                  </Button>
                </div>
              )}
              {cards.isError && <Banner>{t('review.makeCards.error')}</Banner>}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
