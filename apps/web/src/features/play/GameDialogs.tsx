import type { BotProfile, GameResult } from '@kotgambit/contracts';
import type { CoachMessage } from '@kotgambit/coach';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { Confetti } from '../lessons/Confetti';
import { Mascot } from '../mascot/Mascot';
import { BotAvatar, type BotMood } from './BotAvatar';

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

interface ResignDialogProps {
  message: CoachMessage;
  dark: boolean;
  onStay: () => void;
  onResign: () => void;
}

/** The safe answer is the main button and has the focus, giving up is the quiet one. */
export function ResignDialog({ message, dark, onStay, onResign }: ResignDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog label={message.title} onClose={onStay}>
      <Mascot mood={message.mascot} size={96} dark={dark} />
      <span className="rounded-pill bg-coral-tint px-3.5 py-1 text-[14px] font-extrabold text-coral-text">
        {t('play.game.resignDialog.chip')}
      </span>
      <h2 className="m-0 font-heading text-[24px] leading-8 font-bold">{message.title}</h2>
      <p className="m-0 text-[16px] font-semibold text-text-2">{message.text}</p>
      <Button large fullWidth onClick={onStay} data-autofocus>
        {t('play.game.resignDialog.stay')}
      </Button>
      <Button variant="danger" onClick={onResign}>
        {t('play.game.resignDialog.confirm')}
      </Button>
    </Dialog>
  );
}

interface GameOverDialogProps {
  bot: BotProfile;
  result: GameResult;
  message: CoachMessage;
  dark: boolean;
  onAgain: () => void;
  onBots: () => void;
  onClose: () => void;
}

/** The end of a game: the cat and the bot react, the XP is told once, the next game is one press away. */
export function GameOverDialog({
  bot,
  result,
  message,
  dark,
  onAgain,
  onBots,
  onClose,
}: GameOverDialogProps) {
  const { t } = useTranslation();
  const win = result.outcome === 'win';
  return (
    <Dialog label={message.title} onClose={onClose}>
      {message.effect === 'confetti' && <Confetti />}
      <div className="flex items-end justify-center gap-4">
        <Mascot mood={message.mascot} size={110} dark={dark} animate />
        <BotAvatar kind={bot.kind} mood={BOT_MOODS[result.outcome]} size={72} />
      </div>
      <span
        className={`rounded-pill px-3.5 py-1 text-[14px] font-extrabold ${win ? 'bg-mint-tint text-mint-text' : 'bg-surface-2 text-text-2'}`}
      >
        {t(`play.game.over.chip.${chipKey(result)}`)}
      </span>
      <h2 className="m-0 font-heading text-[24px] leading-8 font-bold">{message.title}</h2>
      <p className="m-0 text-[16px] font-semibold text-text-2">{message.text}</p>
      <span className="rounded-pill border-2 border-edge bg-sun px-3.5 py-1 text-[15px] font-extrabold text-on-accent">
        {t(result.outcome === 'loss' ? 'play.game.over.xpGame' : 'play.game.over.xp', {
          xp: result.xp,
        })}
      </span>
      <Button
        variant={win ? 'success' : 'primary'}
        large
        fullWidth
        onClick={onAgain}
        data-autofocus
      >
        {t('play.game.over.again')}
      </Button>
      <Button variant="secondary" fullWidth onClick={onBots}>
        {t('play.game.over.toBots')}
      </Button>
    </Dialog>
  );
}
