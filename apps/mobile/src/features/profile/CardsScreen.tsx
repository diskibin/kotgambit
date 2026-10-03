import { boardReducer, createBoardState, type BoardAction } from '@kotgambit/board-controller';
import { createCoach, type CoachMessage } from '@kotgambit/coach';
import { apiErrorOf, type CardAnswerResponse, type ReviewCard } from '@kotgambit/contracts';
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnswerCardMutation, useNextCardMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { ReplyCard, type ReplyTone } from '../../shared/ui/ReplyCard';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, screenPadding, space, typography } from '../../theme/theme';
import { Board } from '../board/Board';
import { useBoardSize } from '../lessons/StepFrame';
import { Mascot } from '../mascot/Mascot';
import { PremiumNudge } from '../premium/PremiumNudge';

const CAT = 56;
const TURN_MARKER = 28;

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
export function CardsScreen({
  onClose,
  onPremium,
}: {
  onClose: () => void;
  onPremium: () => void;
}) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const coach = useMemo(() => createCoach(), []);
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
    if (requested.current) return;
    requested.current = true;
    void fetchCard();
    // `fetchCard` does not read anything that changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frame = (children: ReactNode) => (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: screenPadding,
        paddingTop: insets.top + screenPadding,
        paddingBottom: insets.bottom + screenPadding,
        gap: space[3],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Text accessibilityRole="header" style={[typography.h1, { color: colors.text, flex: 1 }]}>
          {t('cards.title')}
        </Text>
        {load === 'ready' && (
          <Text style={[typography.small, { color: colors.skyText }]}>
            {t('cards.left', { count: left })}
          </Text>
        )}
        <Button variant="text" label={t('cards.close')} onPress={onClose} />
      </View>
      {children}
    </ScrollView>
  );

  if (load === 'premium') return frame(<PremiumNudge kind="cards" onPremium={onPremium} />);
  if (load === 'ready' && card) {
    return frame(<CardSolver key={card.id} card={card} onNext={() => void fetchCard()} />);
  }

  const empty = load === 'empty' ? coach.message({ type: 'CARD_EMPTY' }) : null;
  return frame(
    <View style={{ alignItems: 'center', gap: space[3], paddingTop: space[6] }}>
      <Mascot
        mood={empty ? empty.mascot : load === 'error' ? 'oops' : 'thinking'}
        size={96}
        dark={scheme === 'dark'}
        animate
      />
      <Text
        accessibilityRole={load === 'loading' ? 'progressbar' : 'header'}
        style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
      >
        {empty ? empty.title : load === 'error' ? t('cards.loadError') : t('cards.loading')}
      </Text>
      {empty && (
        <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
          {empty.text}
        </Text>
      )}
      {load === 'error' && <Button label={t('cards.retry')} onPress={() => void fetchCard()} />}
    </View>,
  );
}

function CardSolver({ card, onNext }: { card: ReviewCard; onNext: () => void }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const boardSize = useBoardSize();
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
    <>
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
            backgroundColor: card.solver === 'w' ? '#FFFFFF' : colors.edge,
          }}
        />
        <Text accessibilityRole="header" style={[typography.h2, { color: colors.text }]}>
          {t(`cards.turn.${card.solver}`)}
        </Text>
      </View>
      <Text style={[typography.small, { color: colors.text2 }]}>
        {t('cards.played', { san: card.playedSan, number: card.moveNumber })}
      </Text>
      <Board
        state={board}
        dispatch={onBoardAction}
        disabled={busy || result !== null}
        arrows={bestArrow}
        size={boardSize}
      />
      {failed && <Banner>{t('cards.moveError')}</Banner>}
      <View style={{ paddingLeft: space[2] }}>
        <Mascot mood={message.mascot} size={CAT} dark={scheme === 'dark'} animate />
      </View>
      <ReplyCard
        tone={TONES[message.tone]}
        title={message.title}
        actions={
          result && (
            <Button
              large
              variant={result.result === 'correct' ? 'success' : 'primary'}
              label={t('cards.next')}
              onPress={onNext}
            />
          )
        }
      >
        {result
          ? `${message.text} ${t('cards.better', { san: result.best.san })} ${t('cards.again', { count: result.nextInDays })}`
          : message.text}
      </ReplyCard>
    </>
  );
}
