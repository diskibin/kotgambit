import type { CoachMessage } from '@kotgambit/coach';
import type { BotProfile, Game, GameResult } from '@kotgambit/contracts';
import { movePairs } from '@kotgambit/game-player';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';
import { BotAvatar, type BotMood } from './BotAvatar';

const CAT = 96;
const BOT = 64;
const MOVES_MAX_HEIGHT = 320;

function chipKey({ outcome, reason }: GameResult): string {
  if (outcome === 'win') return 'winCheckmate';
  if (outcome === 'loss') return reason === 'resignation' ? 'lossResignation' : 'lossCheckmate';
  if (reason === 'stalemate') return 'drawStalemate';
  if (reason === 'insufficient-material') return 'drawInsufficient';
  if (reason === 'fifty-moves') return 'drawFifty';
  return 'drawRepetition';
}

const BOT_MOODS: Record<GameResult['outcome'], BotMood> = {
  win: 'lose',
  loss: 'win',
  draw: 'neutral',
};

function Pill({ text, background, color }: { text: string; background: string; color: string }) {
  return (
    <View
      style={{
        borderRadius: radius.pill,
        backgroundColor: background,
        paddingHorizontal: space[3],
        paddingVertical: space[1],
      }}
    >
      <Text style={[typography.small, { color }]}>{text}</Text>
    </View>
  );
}

interface ResignSheetProps {
  message: CoachMessage;
  onStay: () => void;
  onResign: () => void;
}

/** The safe answer is the main button, giving up is the quiet one. */
export function ResignSheet({ message, onStay, onResign }: ResignSheetProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  return (
    <BottomSheet label={message.title} onClose={onStay}>
      <Mascot mood={message.mascot} size={CAT} dark={scheme === 'dark'} />
      <Pill
        text={t('play.game.resignDialog.chip')}
        background={colors.coralTint}
        color={colors.coralText}
      />
      <Text
        accessibilityRole="header"
        style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
      >
        {message.title}
      </Text>
      <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
        {message.text}
      </Text>
      <Button large label={t('play.game.resignDialog.stay')} onPress={onStay} />
      <Button variant="danger" label={t('play.game.resignDialog.confirm')} onPress={onResign} />
    </BottomSheet>
  );
}

interface OverSheetProps {
  bot: BotProfile;
  result: GameResult;
  message: CoachMessage;
  onAgain: () => void;
  onReview: () => void;
  onBots: () => void;
  onClose: () => void;
}

/** The end of a game: the cat and the bot react, the XP is told once, the next game is one press away. */
export function OverSheet({
  bot,
  result,
  message,
  onAgain,
  onReview,
  onBots,
  onClose,
}: OverSheetProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const win = result.outcome === 'win';
  return (
    <BottomSheet label={message.title} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[3] }}>
        <Mascot mood={message.mascot} size={CAT} dark={scheme === 'dark'} animate />
        <BotAvatar kind={bot.kind} mood={BOT_MOODS[result.outcome]} size={BOT} />
      </View>
      <Pill
        text={t(`play.game.over.chip.${chipKey(result)}`)}
        background={win ? colors.mintTint : colors.surface2}
        color={win ? colors.mintText : colors.text2}
      />
      <Text
        accessibilityRole="header"
        style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
      >
        {message.title}
      </Text>
      <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
        {message.text}
      </Text>
      <Pill
        text={t(result.outcome === 'loss' ? 'play.game.over.xpGame' : 'play.game.over.xp', {
          xp: result.xp,
        })}
        background={colors.sun}
        color={colors.onAccent}
      />
      <Button
        large
        variant={win ? 'success' : 'primary'}
        label={t('play.game.over.again')}
        onPress={onAgain}
      />
      <Button variant="secondary" label={t('play.game.over.review')} onPress={onReview} />
      <Button variant="text" label={t('play.game.over.toBots')} onPress={onBots} />
    </BottomSheet>
  );
}

/** All the moves of the game in two columns, the last one marked. */
export function MovesSheet({ game, onClose }: { game: Game; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pairs = movePairs(game);
  return (
    <BottomSheet label={t('play.game.movesSheet')} onClose={onClose}>
      <Text accessibilityRole="header" style={[typography.h2, { color: colors.text }]}>
        {t('play.game.movesSheet')}
      </Text>
      <ScrollView style={{ maxHeight: MOVES_MAX_HEIGHT, alignSelf: 'stretch' }}>
        {pairs.length === 0 ? (
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {t('play.game.noMoves')}
          </Text>
        ) : (
          pairs.map((pair, index) => {
            const last = index === pairs.length - 1;
            const cell = (text: string | null, current: boolean) => (
              <Text
                style={[
                  typography.body,
                  {
                    flex: 1,
                    color: colors.text,
                    backgroundColor: current ? colors.brandTint : 'transparent',
                    borderRadius: radius.input / 2,
                    paddingHorizontal: space[1],
                  },
                ]}
              >
                {text ?? ''}
              </Text>
            );
            return (
              <View
                key={pair.number}
                accessible
                accessibilityLabel={`${pair.number}. ${pair.white ?? ''} ${pair.black ?? ''}`}
                style={{ flexDirection: 'row', gap: space[2], paddingVertical: 2 }}
              >
                <Text style={[typography.body, { width: 32, color: colors.textMuted }]}>
                  {pair.number}.
                </Text>
                {cell(pair.white, last && pair.black === null)}
                {cell(pair.black, last && pair.black !== null)}
              </View>
            );
          })
        )}
      </ScrollView>
      <Button label={t('play.game.closeSheet')} onPress={onClose} />
    </BottomSheet>
  );
}
