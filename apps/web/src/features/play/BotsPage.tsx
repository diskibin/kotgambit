import { AppShell } from '../../shared/ui/AppShell';
import { apiErrorOf, type BotProfile, type CreateGameRequest } from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useActiveGameQuery, useBotsQuery, useCreateGameMutation } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { CheckIcon, StarIcon, PlayIcon } from '../../shared/ui/icons';
import { pieceUrl } from '../board/pieceAssets';
import { BotAvatar } from './BotAvatar';

type Color = CreateGameRequest['color'];

const COLOR_PIECE = {
  w: { color: 'w', type: 'k' },
  b: { color: 'b', type: 'k' },
  random: { color: 'w', type: 'n' },
} as const;
const COLORS: readonly Color[] = ['w', 'b', 'random'];
const LEVELS = [1, 2, 3, 4, 5, 6] as const;
// The fox: sly, but not too strong, a good first opponent (web/screens/play.md)
const DEFAULT_BOT = 'alisa';

function Stars({ level }: { level: number }) {
  const { t } = useTranslation();
  return (
    <span role="img" aria-label={t('play.pick.level', { level })} className="flex gap-0.5">
      {LEVELS.map((n) => (
        <StarIcon key={n} size={16} className={n <= level ? 'text-sun' : 'text-line'} />
      ))}
    </span>
  );
}

/** Choosing the opponent, the color and the learning mode before a game. */
export function BotsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const status = useAppSelector((state) => state.auth.status);
  const signedIn = status === 'authenticated';
  const bots = useBotsQuery(undefined, { skip: !signedIn });
  const active = useActiveGameQuery(undefined, { skip: !signedIn });
  const [create, creation] = useCreateGameMutation();
  const [botId, setBotId] = useState(DEFAULT_BOT);
  const [color, setColor] = useState<Color>('w');
  const [learning, setLearning] = useState(true);
  const [message, setMessage] = useState('');

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const list: BotProfile[] = bots.data?.bots ?? [];
  const chosen = list.find((bot) => bot.id === botId) ?? list[0];
  const unfinished = active.data?.game ?? null;
  const unfinishedBot = list.find((bot) => bot.id === unfinished?.botId);

  async function start() {
    if (!chosen) return;
    setMessage('');
    const result = await create({ botId: chosen.id, color, learning });
    if ('data' in result && result.data) {
      void navigate(`/play/${result.data.id}`);
      return;
    }
    setMessage(apiErrorOf(result.error)?.message ?? t('play.pick.startError'));
  }

  return (
    <AppShell active="play" title={t('play.title')}>
      <div className="flex flex-col gap-6">
        {bots.isError && (
          <div className="flex flex-col gap-3">
            <Banner>{t('play.loadError')}</Banner>
            <Button className="self-start" onClick={() => void bots.refetch()}>
              {t('play.retry')}
            </Button>
          </div>
        )}
        {bots.isLoading && (
          <p role="status" className="m-0 text-[16px] font-bold text-text-2">
            {t('play.loading')}
          </p>
        )}

        {unfinished && unfinishedBot && (
          <section
            aria-label={t('play.pick.resume.title')}
            className="flex flex-wrap items-center gap-4 rounded-card border-2 border-edge bg-sun-tint p-4 shadow-shashka"
          >
            <BotAvatar kind={unfinishedBot.kind} size={56} />
            <div className="flex flex-1 flex-col">
              <strong className="font-heading text-[18px]">{t('play.pick.resume.title')}</strong>
              <span className="text-[15px] font-semibold text-text-2">
                {t('play.pick.resume.text', { name: unfinishedBot.instrumental })}
              </span>
            </div>
            <Button onClick={() => void navigate(`/play/${unfinished.id}`)}>
              {t('play.pick.resume.button')}
            </Button>
          </section>
        )}

        {chosen && (
          <div className="grid gap-7 laptop:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-labelledby="pick-title" className="flex flex-col gap-4">
              <h2 id="pick-title" className="m-0 font-heading text-[19px] leading-[27px] font-bold">
                {t('play.pick.title')}
              </h2>
              <div
                role="radiogroup"
                aria-label={t('play.pick.botsLabel')}
                className="grid gap-4 tablet:grid-cols-2 laptop:grid-cols-3"
              >
                {list.map((bot) => {
                  const selected = bot.id === chosen.id;
                  return (
                    <button
                      key={bot.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setBotId(bot.id)}
                      className={`relative flex min-h-[232px] flex-col items-center gap-2 rounded-panel border-2 border-edge px-4 py-[18px] text-center text-text shadow-shashka ${
                        selected ? 'bg-brand-tint' : 'bg-surface'
                      }`}
                    >
                      {selected && (
                        <span
                          aria-hidden="true"
                          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-brand text-on-brand"
                        >
                          <CheckIcon size={18} />
                        </span>
                      )}
                      <BotAvatar kind={bot.kind} size={96} />
                      <b className="text-[20px] leading-[26px]">{bot.name}</b>
                      <Stars level={bot.level} />
                      <span className="text-[15px] leading-[22px] font-semibold text-text-2">
                        {bot.character}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside
              aria-label={t('play.pick.settings')}
              className="flex flex-col gap-4 laptop:min-h-[560px]"
            >
              <section
                aria-labelledby="color-title"
                className="flex flex-col gap-3 rounded-panel border-2 border-line bg-surface p-5"
              >
                <h2 id="color-title" className="m-0 text-[18px] font-bold">
                  {t('play.pick.colorTitle')}
                </h2>
                <div
                  role="radiogroup"
                  aria-labelledby="color-title"
                  className="grid grid-cols-3 gap-2"
                >
                  {COLORS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={color === value}
                      onClick={() => setColor(value)}
                      className={`flex h-[92px] flex-col items-center justify-center gap-1 rounded-card border-2 border-edge text-[14px] font-extrabold shadow-shashka ${
                        color === value ? 'bg-brand-tint' : 'bg-surface'
                      }`}
                    >
                      <img
                        src={pieceUrl(COLOR_PIECE[value].color, COLOR_PIECE[value].type)}
                        alt=""
                        className="size-11"
                      />
                      {t(`play.pick.color.${value}`)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-panel border-2 border-line bg-surface p-5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={learning}
                  onClick={() => setLearning(!learning)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
                >
                  <span className="flex flex-col">
                    <b className="text-[18px]">{t('play.pick.learning.title')}</b>
                    <span className="text-[14px] leading-5 font-semibold text-text-2">
                      {t('play.pick.learning.text')}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative block h-8 w-[52px] shrink-0 rounded-pill ${learning ? 'bg-mint' : 'bg-line-strong'}`}
                  >
                    <span
                      className={`absolute top-1 size-6 rounded-full bg-surface ${learning ? 'left-6' : 'left-1'}`}
                    />
                  </span>
                </button>
              </section>

              <section className="flex flex-col gap-3.5 rounded-panel border-2 border-brand-tint-depth bg-brand-tint p-5 laptop:mt-auto">
                <div className="flex items-center gap-3">
                  <BotAvatar kind={chosen.kind} size={64} />
                  <p className="relative m-0 rounded-[16px] bg-surface px-3.5 py-2.5 text-[16px] leading-[22px] font-bold">
                    {chosen.greeting}
                    <span
                      aria-hidden="true"
                      className="absolute top-4 -left-[7px] size-3.5 rotate-45 bg-surface"
                    />
                  </p>
                </div>
                {message && <Banner>{message}</Banner>}
                <Button large disabled={creation.isLoading} onClick={() => void start()}>
                  {creation.isLoading ? t('play.pick.starting') : t('play.pick.start')}
                  <PlayIcon size={22} />
                </Button>
              </section>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
