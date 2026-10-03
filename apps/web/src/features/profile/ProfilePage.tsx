import { AppShell } from '../../shared/ui/AppShell';
import { levelPercent, monthGenitive, weekdayShort, yearOf } from '@kotgambit/game-player';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useLogoutMutation, useProfileQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { localDateKey } from '../../shared/localDate';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { LockIcon } from '../../shared/ui/icons';
import { Mascot } from '../mascot/Mascot';
import { MonthCalendar, RatingGraph } from './Progress';
import { Wardrobe } from './Wardrobe';
import { useScheme } from '../theme/useScheme';

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border-2 border-line bg-surface p-4">
      <span className="text-[13px] font-extrabold tracking-[0.05em] text-text-2 uppercase">
        {label}
      </span>
      <span className="font-heading text-[26px] leading-8 font-bold">{value}</span>
      <span className="text-[13px] font-semibold text-text-muted">{sub}</span>
    </div>
  );
}

/** What the learner has done so far: level, streak, the week, achievements and the weak themes. */
export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  const status = useAppSelector((state) => state.auth.status);
  const profile = useProfileQuery(localDateKey(), { skip: status !== 'authenticated' });
  const [logout] = useLogoutMutation();

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const data = profile.data;
  const weakest = data?.themes[0];
  const unlocked = data?.achievements.filter((a) => a.unlocked).length ?? 0;

  return (
    <AppShell active="profile" title={t('profile.title')}>
      <div className="flex max-w-[1200px] flex-col gap-6">
        {profile.isError && (
          <div className="flex flex-col gap-3">
            <Banner>{t('profile.loadError')}</Banner>
            <Button className="self-start" onClick={() => void profile.refetch()}>
              {t('profile.retry')}
            </Button>
          </div>
        )}
        {profile.isLoading && (
          <p role="status" className="m-0 text-[16px] font-bold text-text-2">
            {t('profile.loading')}
          </p>
        )}

        {data && (
          <div className="grid gap-8 laptop:grid-cols-[360px_minmax(0,1fr)]">
            <div className="flex flex-col gap-6">
              <section className="flex flex-col items-center gap-3 rounded-card border-2 border-edge bg-surface p-6 shadow-shashka">
                <div className="relative flex size-[200px] items-center justify-center rounded-full bg-brand-tint">
                  <Mascot mood="proud" size={170} dark={scheme === 'dark'} animate />
                  <span className="absolute right-2 bottom-2 rounded-pill border-2 border-edge bg-sun px-3 py-1 text-[14px] font-extrabold text-on-accent">
                    {t('profile.level', { level: data.level.level })}
                  </span>
                </div>
                <h2 className="m-0 font-heading text-[22px] font-bold">
                  {data.displayName ?? t('profile.guest')}
                </h2>
                <p className="m-0 text-[15px] font-semibold text-text-2">
                  {t('profile.memberSince', {
                    month: monthGenitive(data.memberSince),
                    year: yearOf(data.memberSince),
                  })}
                </p>
                <div className="flex w-full flex-col gap-1">
                  <span className="text-[14px] font-bold text-text-2">
                    {t('profile.toNext', {
                      next: data.level.level + 1,
                      xp: data.level.xpInLevel,
                      total: data.level.xpForNext,
                    })}
                  </span>
                  <div
                    role="progressbar"
                    aria-label={t('profile.levelBar', { level: data.level.level })}
                    aria-valuemin={0}
                    aria-valuemax={data.level.xpForNext}
                    aria-valuenow={data.level.xpInLevel}
                    className="h-4 overflow-hidden rounded-pill border-2 border-edge bg-surface"
                  >
                    <div
                      style={{
                        width: `${levelPercent(data.level.xpInLevel, data.level.xpForNext)}%`,
                      }}
                      className="h-full bg-sun"
                    />
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 border-t-2 border-line pt-3">
                  <strong className="text-[16px]">{t('profile.cards.title')}</strong>
                  <span className="text-[14px] font-semibold text-text-2">
                    {data.cards.total === 0
                      ? t('profile.cards.none')
                      : t('profile.cards.due', { count: data.cards.due })}
                  </span>
                  {data.cards.due > 0 && (
                    <Button variant="secondary" onClick={() => void navigate('/cards')}>
                      {t('profile.cards.start')}
                    </Button>
                  )}
                </div>
                <Button variant="secondary" fullWidth onClick={() => void navigate('/settings')}>
                  {t('settings.title')}
                </Button>
                <Button variant="secondary" fullWidth onClick={() => void logout()}>
                  {t('path.signOut')}
                </Button>
              </section>
              <Wardrobe wardrobe={data.wardrobe} />
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
                <Tile
                  label={t('profile.tiles.streak')}
                  value={t('profile.tiles.streakValue', { count: data.streak.current })}
                  sub={t('profile.tiles.streakBest', { best: data.streak.best })}
                />
                <Tile
                  label={t('profile.tiles.xp')}
                  value={String(data.xpTotal)}
                  sub={t('profile.tiles.xpSub')}
                />
                <Tile
                  label={t('profile.tiles.puzzles')}
                  value={String(data.puzzles.solved)}
                  sub={t('profile.tiles.puzzlesSub', { rating: data.puzzles.rating })}
                />
                <Tile
                  label={t('profile.tiles.games')}
                  value={String(data.games.played)}
                  sub={t('profile.tiles.gamesSub', {
                    wins: data.games.wins,
                    draws: data.games.draws,
                    losses: data.games.losses,
                  })}
                />
              </div>

              <section className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="m-0 text-[18px] font-extrabold">{t('profile.week.title')}</h2>
                  <span className="text-[14px] font-bold text-flame-text">
                    {t('profile.week.line', {
                      current: data.streak.current,
                      best: data.streak.best,
                    })}
                  </span>
                </div>
                <ol className="m-0 grid list-none grid-cols-7 gap-2 p-0">
                  {data.week.map((day) => (
                    <li
                      key={day.day}
                      aria-label={`${weekdayShort(day.day)}: ${day.done ? t('profile.week.done') : t('profile.week.missed')}${day.today ? `, ${t('profile.week.today')}` : ''}`}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-11 items-center justify-center rounded-[10px] border-2 border-edge ${day.done ? 'bg-board-a' : 'bg-surface'} ${day.today ? 'ring-4 ring-brand' : ''}`}
                      />
                      <span aria-hidden="true" className="text-[13px] font-bold text-text-2">
                        {weekdayShort(day.day)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="grid gap-6 desktop:grid-cols-2">
                <MonthCalendar profile={data} />
                <RatingGraph history={data.ratingHistory} />
              </div>

              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="m-0 text-[18px] font-extrabold">
                    {t('profile.achievements.title')}
                  </h2>
                  <span className="text-[14px] font-bold text-text-2">
                    {t('profile.achievements.count', {
                      done: unlocked,
                      total: data.achievements.length,
                    })}
                  </span>
                </div>
                <ul className="m-0 grid list-none gap-3 p-0 tablet:grid-cols-2">
                  {data.achievements.map((achievement) => (
                    <li
                      key={achievement.key}
                      className={`flex items-center gap-3 rounded-card border-2 p-3 ${achievement.unlocked ? 'border-edge bg-sun-tint' : 'border-dashed border-line bg-surface opacity-80'}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-10 items-center justify-center rounded-full border-2 border-edge ${achievement.unlocked ? 'bg-sun' : 'bg-surface-2'}`}
                      >
                        {achievement.unlocked ? '★' : <LockIcon size={18} />}
                      </span>
                      <div className="flex flex-col">
                        <strong className="text-[15px]">
                          {t(`profile.achievements.key.${achievement.key}`)}
                        </strong>
                        <span className="text-[13px] font-semibold text-text-2">
                          {achievement.unlocked
                            ? t('profile.achievements.unlocked')
                            : achievement.current === 0 && achievement.target === 1
                              ? t('profile.achievements.never')
                              : t('profile.achievements.progress', {
                                  current: achievement.current,
                                  target: achievement.target,
                                })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4">
                <h2 className="m-0 text-[18px] font-extrabold">{t('profile.themes.title')}</h2>
                <p className="m-0 text-[14px] font-semibold text-text-2">
                  {t('profile.themes.caption')}
                </p>
                {data.themes.length === 0 ? (
                  <p className="m-0 text-[15px] font-semibold text-text-muted">
                    {t('profile.themes.none')}
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {data.themes.map((theme) => (
                      <li key={theme.key} className="flex items-center gap-3">
                        <span className="w-44 shrink-0 text-[15px] font-semibold">
                          {theme.title}
                        </span>
                        <div
                          role="progressbar"
                          aria-label={theme.title}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={theme.accuracy}
                          className="h-3 flex-1 overflow-hidden rounded-pill bg-surface-2"
                        >
                          <div
                            style={{ width: `${theme.accuracy}%` }}
                            className={`h-full ${theme.accuracy < 40 ? 'bg-coral' : 'bg-mint'}`}
                          />
                        </div>
                        <span className="w-12 text-right text-[14px] font-bold">
                          {theme.accuracy}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {weakest && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[15px] font-semibold">
                      {t('profile.themes.weakest', { title: weakest.title })}
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void navigate(`/puzzles/solve?mode=theme&theme=${weakest.key}`)
                      }
                    >
                      {t('profile.themes.practice')}
                    </Button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
