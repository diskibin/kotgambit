import type { Game, GameReview, KeyMoment } from '@kotgambit/contracts';
import {
  QUALITY_MARKS,
  chancesGraph,
  graphPath,
  lastMoveNumber,
  type Quality,
} from '@kotgambit/game-player';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useBotsQuery, useGameQuery, useReviewQuery, useStartReviewMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, shashka, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { PositionPreview } from '../puzzles/PositionPreview';

const POLL_MS = 1500;
const GRAPH_WIDTH = 304;
const GRAPH_HEIGHT = 84;
const MOMENT_BOARD = 118;
const CAT = 88;
const QUALITIES: readonly Quality[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'];

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

function Tile({ value, label }: { value: number | null; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value === null ? '' : `${value}%`}`}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: space[1],
        padding: space[3],
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: colors.line,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={[typography.h1, { color: colors.text }]}>
        {value === null ? '—' : `${value}%`}
      </Text>
      <Text style={[typography.caption, { color: colors.text2 }]}>{label}</Text>
    </View>
  );
}

function Graph({ review }: { review: GameReview }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const points = chancesGraph(review.chances, GRAPH_WIDTH, GRAPH_HEIGHT);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('review.result.graphLabel')}
      style={{
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        alignItems: 'center',
        padding: space[2],
      }}
    >
      <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}>
        <Line
          x1={0}
          x2={GRAPH_WIDTH}
          y1={GRAPH_HEIGHT / 2}
          y2={GRAPH_HEIGHT / 2}
          stroke={colors.line}
          strokeDasharray="4 4"
        />
        <Path
          d={graphPath(points)}
          fill="none"
          stroke={colors.brand}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {review.qualities.map((quality, index) => {
          const point = points[index + 1];
          if (!point || (quality !== 'blunder' && quality !== 'mistake')) return null;
          return (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={5}
              fill={colors.coral}
              stroke={colors.edge}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function Moment({ moment, orientation }: { moment: KeyMoment; orientation: 'w' | 'b' }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bad = moment.kind !== 'highlight';
  const title = t(moment.color === 'w' ? 'review.result.moveOf' : 'review.result.moveOfBlack', {
    number: moment.moveNumber,
    san: moment.played.san,
  });
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${moment.explanation}`}
      style={{
        flexDirection: 'row',
        gap: space[3],
        padding: space[3],
        borderRadius: radius.card,
        borderWidth: shashka.border,
        borderColor: bad ? colors.coralBorder : colors.edge,
        backgroundColor: bad ? colors.coralTint : colors.mintTint,
      }}
    >
      <PositionPreview
        fen={moment.fen}
        orientation={orientation}
        size={MOMENT_BOARD}
        label={title}
      />
      <View style={{ flex: 1, gap: space[1] }}>
        <Text style={[typography.small, { color: colors.text }]}>
          {QUALITY_MARKS[moment.kind === 'highlight' ? 'best' : moment.kind]}
        </Text>
        <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
        <Text style={[typography.small, { color: colors.text2 }]}>{moment.explanation}</Text>
        {moment.better && (
          <Text style={[typography.caption, { color: colors.text2 }]}>
            {t('review.result.better', { san: moment.better.san })}
          </Text>
        )}
      </View>
    </View>
  );
}

/** The look back at a finished game: the accuracy, the graph and the moments worth a card. */
export function ReviewScreen({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const game = useGameQuery(id);
  const bots = useBotsQuery();
  const [startReview] = useStartReviewMutation();
  const started = useRef(false);
  const ready = game.data?.status === 'finished';
  const review = useReviewPolling(id, ready);

  // Asking twice is fine for the server, but there is no reason to ask more than once per screen
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void startReview(id);
  }, [ready, id, startReview]);

  const bot = bots.data?.bots.find((candidate) => candidate.id === game.data?.botId);
  const data = review.data;
  const result = data?.review ?? null;

  const frame = (children: ReactNode) => (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: screenPadding,
        paddingTop: insets.top + screenPadding,
        paddingBottom: insets.bottom + screenPadding,
        gap: space[4],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Text accessibilityRole="header" style={[typography.h1, { color: colors.text, flex: 1 }]}>
          {t('review.title')}
        </Text>
        <Button variant="text" label={t('review.close')} onPress={onClose} />
      </View>
      {children}
    </ScrollView>
  );

  if (game.isError || review.isError) return frame(<Banner>{t('review.loadError')}</Banner>);

  if (!data || (data.status !== 'done' && data.status !== 'failed')) {
    return frame(
      <View style={{ alignItems: 'center', gap: space[3] }}>
        <Mascot mood="thinking" size={CAT} dark={scheme === 'dark'} animate />
        <Text
          accessibilityRole="header"
          style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
        >
          {t('review.loading.title')}
        </Text>
        <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
          {t('review.loading.text')}
        </Text>
        {data && (
          <ProgressBar
            value={data.done}
            max={data.total}
            label={t('review.loading.progress', { done: data.done, total: data.total })}
          />
        )}
      </View>,
    );
  }

  if (data.status === 'failed' || !result) {
    return frame(
      <View style={{ alignItems: 'center', gap: space[3] }}>
        <Mascot mood="oops" size={CAT} dark={scheme === 'dark'} />
        <Text
          accessibilityRole="header"
          style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
        >
          {t('review.failed.title')}
        </Text>
        <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
          {t('review.failed.text')}
        </Text>
        <Button label={t('review.failed.retry')} onPress={() => void startReview(id)} />
      </View>,
    );
  }

  return frame(
    <>
      {game.data && bot && (
        <View>
          <Text style={[typography.h3, { color: colors.text }]}>
            {t('review.result.withBot', { name: bot.name })}
          </Text>
          <Text style={[typography.small, { color: colors.text2 }]}>
            {outcomeLine(game.data, t)}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Tile value={result.accuracy.player} label={t('review.result.you')} />
        <Tile value={result.accuracy.bot} label={bot?.name ?? ''} />
      </View>

      <View style={{ gap: space[2] }}>
        <Text style={[typography.h3, { color: colors.text }]}>{t('review.result.quality')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {QUALITIES.filter(
            (quality) => quality !== 'inaccuracy' || result.counts.inaccuracy > 0,
          ).map((quality) => (
            <View
              key={quality}
              style={{
                borderRadius: radius.pill,
                backgroundColor: colors.surface2,
                paddingHorizontal: space[3],
                paddingVertical: space[1],
              }}
            >
              <Text style={[typography.small, { color: colors.text }]}>
                {QUALITY_MARKS[quality]} {result.counts[quality]}{' '}
                {t(`review.result.quality_${quality}`)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: space[2] }}>
        <Text style={[typography.h3, { color: colors.text }]}>{t('review.result.graph')}</Text>
        <Graph review={result} />
      </View>

      <View style={{ gap: space[3] }}>
        <Text style={[typography.h3, { color: colors.text }]}>{t('review.result.moments')}</Text>
        {result.keyMoments.length === 0 && (
          <Text style={[typography.body, { color: colors.text2 }]}>
            {t('review.result.noMoments')}
          </Text>
        )}
        {result.keyMoments.map((moment) => (
          <Moment key={moment.ply} moment={moment} orientation={game.data?.userColor ?? 'w'} />
        ))}
      </View>
    </>,
  );
}
