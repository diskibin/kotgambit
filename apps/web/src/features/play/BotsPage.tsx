import { apiErrorOf, type BotProfile, type CreateGameRequest } from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useActiveGameQuery, useBotsQuery, useCreateGameMutation } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { CheckIcon, PlayIcon } from '../../shared/ui/icons';
import { BotAvatar } from './BotAvatar';

type Color = CreateGameRequest['color'];

const COLORS: readonly Color[] = ['w', 'b', 'random'];
const LEVELS = [1, 2, 3, 4, 5, 6] as const;
// The fox: sly, but not too strong, a good first opponent (web/screens/play.md)
const DEFAULT_BOT = 'alisa';

function Stars({ level }: { level: number }) {
  const { t } = useTranslation();
  return (
    <span role="img" aria-label={t('play.pick.level', { level })} className="flex gap-1">
      {LEVELS.map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={`size-3.5 rounded-full ${n <= level ? 'bg-sun' : 'bg-line'}`}
        />
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
    <div className="min-h-screen bg-bg text-text">
      <header className="flex min-h-[88px] flex-wrap items-center justify-between gap-4 border-b-2 border-line px-4 tablet:px-10">
        <h1 className="m-0 font-heading text-[24px] font-bold">{t('play.title')}</h1>
        <Button variant="text" onClick={() => void navigate('/')}>
          {t('lesson.complete.home')}
        </Button>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 pr-6 tablet:px-10">
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
          <div className="grid gap-8 laptop:grid-cols-[1fr_340px]">
            <section aria-labelledby="pick-title" className="flex flex-col gap-4">
              <h2 id="pick-title" className="m-0 font-heading text-[26px] font-bold">
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
                      className={`relative flex min-h-[232px] flex-col items-start gap-3 rounded-card border-2 p-4 text-left ${
                        selected
                          ? 'border-brand bg-brand-tint'
                          : 'border-line bg-surface hover:bg-surface-2'
                      }`}
                    >
                      {selected && (
                        <span
                          aria-hidden="true"
                          className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-brand text-on-brand"
                        >
                          <CheckIcon size={18} />
                        </span>
                      )}
                      <BotAvatar kind={bot.kind} size={96} />
                      <span className="text-[20px] font-bold">{bot.name}</span>
                      <Stars level={bot.level} />
                      <span className="text-[15px] font-semibold text-text-2">{bot.character}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="flex flex-col gap-5">
              <section aria-labelledby="color-title" className="flex flex-col gap-3">
                <h2 id="color-title" className="m-0 text-[16px] font-extrabold">
                  {t('play.pick.colorTitle')}
                </h2>
                <div
                  role="radiogroup"
                  aria-labelledby="color-title"
                  className="grid grid-cols-3 gap-3"
                >
                  {COLORS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={color === value}
                      onClick={() => setColor(value)}
                      className={`min-h-14 rounded-card border-2 px-2 text-[15px] font-extrabold ${
                        color === value
                          ? 'border-edge bg-surface shadow-shashka'
                          : 'border-line bg-surface hover:bg-surface-2'
                      }`}
                    >
                      {t(`play.pick.color.${value}`)}
                    </button>
                  ))}
                </div>
              </section>

              <button
                type="button"
                role="switch"
                aria-checked={learning}
                onClick={() => setLearning(!learning)}
                className="flex min-h-14 items-center gap-3 rounded-card border-2 border-line bg-surface p-3 text-left"
              >
                <span className="flex flex-1 flex-col">
                  <strong className="text-[16px]">{t('play.pick.learning.title')}</strong>
                  <span className="text-[14px] font-semibold text-text-2">
                    {t('play.pick.learning.text')}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-12 shrink-0 items-center rounded-pill border-2 border-edge px-0.5 ${learning ? 'justify-end bg-brand' : 'justify-start bg-line'}`}
                >
                  <span className="size-5 rounded-full border-2 border-edge bg-white" />
                </span>
              </button>

              <div className="flex items-center gap-3 rounded-card border-2 border-line bg-brand-tint p-4">
                <BotAvatar kind={chosen.kind} size={64} />
                <p className="m-0 flex-1 text-[15px] font-semibold">{chosen.greeting}</p>
              </div>

              {message && <Banner>{message}</Banner>}
              <Button large disabled={creation.isLoading} onClick={() => void start()}>
                <PlayIcon />
                {creation.isLoading ? t('play.pick.starting') : t('play.pick.start')}
              </Button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
