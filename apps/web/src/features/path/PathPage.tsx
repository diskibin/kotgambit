import { TRACKS } from '@kotgambit/content-schema';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useLessonsQuery, useLogoutMutation, useProgressQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { localDateKey } from '../../shared/localDate';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { pieceUrl } from '../board/pieceAssets';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { ChapterCard } from './ChapterCard';
import { DayBar } from './DayBar';

const PERCENT = 100;

/** The home screen: a ribbon of chapters for every track, the day bar and the cat. */
export function PathPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  const status = useAppSelector((state) => state.auth.status);
  const signedIn = status === 'authenticated';
  const lessons = useLessonsQuery(undefined, { skip: !signedIn });
  const progress = useProgressQuery(localDateKey(), { skip: !signedIn });
  const [logout] = useLogoutMutation();

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const catalog = lessons.data?.lessons ?? [];
  const tracks = TRACKS.filter((track) => catalog.some((lesson) => lesson.track === track));
  const current = catalog.find((lesson) => lesson.status === 'available');

  let bubble = '';
  if (current) {
    bubble = t(current.order === 1 ? 'path.bubble.first' : 'path.bubble.next', {
      title: current.title,
    });
  } else if (catalog.length > 0) {
    bubble = t('path.bubble.allDone');
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex min-h-[88px] flex-wrap items-center justify-between gap-4 border-b-2 border-line px-4 tablet:px-10">
        <h1 className="m-0 font-heading text-[24px] font-bold">{t('path.title')}</h1>
        <div className="flex items-center gap-5">
          {progress.data && <DayBar progress={progress.data} />}
          <Button variant="text" onClick={() => void navigate('/puzzles')}>
            {t('puzzles.title')}
          </Button>
          <Button variant="text" onClick={() => void navigate('/play')}>
            {t('play.title')}
          </Button>
          <Button variant="text" onClick={() => void navigate('/analysis')}>
            {t('analysis.title')}
          </Button>
          <Button variant="text" onClick={() => void logout()}>
            {t('path.signOut')}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-8 pr-6 tablet:px-10">
        {lessons.isError && (
          <div className="flex flex-col gap-3">
            <Banner>{t('path.loadError')}</Banner>
            <Button className="self-start" onClick={() => void lessons.refetch()}>
              {t('lesson.retryLoad')}
            </Button>
          </div>
        )}

        {lessons.isLoading && (
          <p role="status" className="m-0 text-[16px] font-bold text-text-2">
            {t('path.loading')}
          </p>
        )}

        {tracks.map((track, trackIndex) => {
          const items = catalog.filter((lesson) => lesson.track === track);
          const done = items.filter((lesson) => lesson.status === 'completed').length;
          return (
            <section key={track} aria-labelledby={`track-${track}`} className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-card border-2 border-edge bg-brand">
                  <img src={pieceUrl('w', 'k')} alt="" className="size-11" />
                </span>
                <div className="flex flex-col">
                  <span className="text-[13px] font-extrabold tracking-[0.05em] text-text-2 uppercase">
                    {t('path.section', {
                      n: trackIndex + 1,
                      about: t(`path.sectionAbout.${track}`, { defaultValue: '' }),
                    })}
                  </span>
                  <h2 id={`track-${track}`} className="m-0 font-heading text-[24px] font-bold">
                    {t(`tracks.${track}`)}
                  </h2>
                </div>
                <div className="flex min-w-[240px] flex-col gap-1 tablet:ml-auto">
                  <ProgressBar value={done} max={items.length} label={t(`tracks.${track}`)} />
                  <span className="text-[13px] font-bold text-text-2">
                    {t('path.progress', {
                      done,
                      total: items.length,
                      percent: Math.round((done / items.length) * PERCENT),
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-end gap-4 overflow-x-auto pt-16 pr-2 pb-3">
                {items.map((lesson) => (
                  <ChapterCard
                    key={lesson.id}
                    lesson={lesson}
                    current={lesson.id === current?.id}
                    dark={scheme === 'dark'}
                    onOpen={(id) => void navigate(`/lesson/${id}`)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {bubble && (
          <aside className="flex items-end gap-4">
            <Mascot mood={current ? 'wave' : 'proud'} size={110} dark={scheme === 'dark'} animate />
            <p className="m-0 max-w-[260px] rounded-card border-2 border-line bg-surface px-4 py-3 text-[15px] leading-[22px] font-semibold">
              {bubble}
            </p>
          </aside>
        )}
      </main>
    </div>
  );
}
