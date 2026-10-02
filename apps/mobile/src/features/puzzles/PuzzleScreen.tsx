import { apiErrorOf, type Puzzle } from '@kotgambit/contracts';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNextPuzzleMutation, usePuzzleStatsQuery } from '../../app/api';
import { localDateKey } from '../../shared/localDate';
import { Button } from '../../shared/ui/Button';
import { CloseIcon } from '../../shared/ui/icons';
import { IconButton } from '../../shared/ui/IconButton';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { PuzzleSolver } from './PuzzleSolver';
import type { PuzzleRequest } from './PuzzlesScreen';

const HTTP_UNAVAILABLE = 503;
const HTTP_NOT_FOUND = 404;

type Load = 'loading' | 'ready' | 'none' | 'busy' | 'error';

function statusOf(error: unknown): number | null {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : null;
}

const pill = (background: string) => ({
  borderRadius: radius.pill,
  backgroundColor: background,
  paddingHorizontal: space[3],
  paddingVertical: space[1],
});

/** The solving screen in focus mode: takes a puzzle from the server and hands it to the solver. */
export function PuzzleScreen({
  request,
  onClose,
}: {
  request: PuzzleRequest;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [nextPuzzle] = useNextPuzzleMutation();
  const stats = usePuzzleStatsQuery();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [load, setLoad] = useState<Load>('loading');
  const [serverMessage, setServerMessage] = useState('');
  const requested = useRef(false);

  /** Asks for a puzzle and shows what came of it. The state changes only once the answer is in. */
  async function fetchPuzzle() {
    const result = await nextPuzzle({
      mode: request.mode,
      ...(request.theme ? { theme: request.theme } : {}),
      localDate: localDateKey(),
    });
    if ('data' in result && result.data) {
      setPuzzle(result.data);
      setLoad('ready');
      return;
    }
    const status = statusOf(result.error);
    setServerMessage(apiErrorOf(result.error)?.message ?? '');
    setLoad(status === HTTP_NOT_FOUND ? 'none' : status === HTTP_UNAVAILABLE ? 'busy' : 'error');
  }

  /** "Next puzzle" and "Try again": the screen shows that it is working before the answer comes. */
  function start() {
    setLoad('loading');
    void fetchPuzzle();
  }

  // Once per screen: a second request would leave the first attempt behind as a skip
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void fetchPuzzle();
    // `fetchPuzzle` only reads the request, which is fixed for this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (load === 'ready' && puzzle) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            paddingHorizontal: screenPadding,
          }}
        >
          <IconButton quiet label={t('puzzles.solve.close')} onPress={onClose}>
            <CloseIcon color={colors.text} />
          </IconButton>
          {request.mode === 'theme' && puzzle.themes[0] && (
            <View style={pill(colors.surface2)}>
              <Text style={[typography.small, { color: colors.text }]}>
                {puzzle.themes[0].title}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {stats.data && stats.data.streak > 0 && (
            <View style={pill(colors.mintTint)}>
              <Text style={[typography.small, { color: colors.mintText }]}>
                {t('puzzles.solve.streak', { count: stats.data.streak })}
              </Text>
            </View>
          )}
          {stats.data && (
            <View style={pill(colors.skyTint)}>
              <Text style={[typography.small, { color: colors.skyText }]}>
                {t('puzzles.solve.ratingChip', { rating: stats.data.rating })}
              </Text>
            </View>
          )}
        </View>
        <PuzzleSolver key={puzzle.attemptId} puzzle={puzzle} onNext={start} />
      </View>
    );
  }

  const noneForReview = load === 'none' && request.mode === 'review';
  const title = {
    loading: t('puzzles.solve.starting'),
    none: noneForReview
      ? t('puzzles.mistakes.emptyTitle')
      : serverMessage || t('puzzles.solve.noPuzzles'),
    busy: t('puzzles.busy.title'),
    error: t('puzzles.solve.loadError'),
    ready: '',
  }[load];
  const text = noneForReview
    ? t('puzzles.mistakes.emptyText')
    : load === 'busy'
      ? t('puzzles.busy.text')
      : null;
  const mood = load === 'error' ? 'oops' : noneForReview ? 'proud' : 'thinking';

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[3],
        padding: screenPadding,
        backgroundColor: colors.bg,
      }}
    >
      <Mascot mood={mood} size={140} dark={scheme === 'dark'} animate />
      {load === 'busy' && (
        <View style={pill(colors.sunTint)}>
          <Text style={[typography.small, { color: colors.sunText }]}>
            {t('puzzles.busy.chip')}
          </Text>
        </View>
      )}
      <Text
        accessibilityRole="header"
        style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
      >
        {title}
      </Text>
      {text && (
        <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>{text}</Text>
      )}
      {load !== 'loading' && (
        <View style={{ gap: space[2], alignSelf: 'stretch' }}>
          {(load === 'busy' || load === 'error') && (
            <Button large label={t('puzzles.busy.retry')} onPress={start} />
          )}
          <Button variant="secondary" label={t('puzzles.mistakes.back')} onPress={onClose} />
        </View>
      )}
    </View>
  );
}
