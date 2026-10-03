import { TRACKS } from '@kotgambit/content-schema';
import type { LessonSummary } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useDailyPuzzleQuery, useLessonsQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { localDateKey } from '../../shared/localDate';
import { useNavLayout } from '../../shared/useNavLayout';
import { AppShell } from '../../shared/ui/AppShell';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { LockIcon } from '../../shared/ui/icons';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { pieceUrl } from '../board/pieceAssets';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { ChapterCard } from './ChapterCard';
import { PositionBoard } from './PositionBoard';
import { StreakToast } from './StreakToast';

const PERCENT = 100;
const SKELETON_CARDS = 4;

type Track = (typeof TRACKS)[number];

function Skeleton() {
  const { t } = useTranslation();
  const dark = useScheme() === 'dark';
  return (
    <div role="status" className="flex flex-col gap-8">
      <div className="h-14 w-72 animate-pulse rounded-card bg-surface-2 motion-reduce:animate-none" />
      <div className="flex flex-wrap items-end gap-[18px]">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <div
            key={index}
            className="h-60 w-[200px] shrink-0 animate-pulse rounded-chapter border-2 border-dashed border-dashed bg-surface motion-reduce:animate-none"
          />
        ))}
        <div className="flex items-end gap-3">
          <Mascot mood="thinking" size={110} dark={dark} />
          <p className="m-0 max-w-[220px] rounded-card border-2 border-line bg-surface px-4 py-3 text-[15px] leading-[22px] font-semibold">
            <b>{t('path.loadingTitle')}</b>
            <br />
            {t('path.loading')}
          </p>
        </div>
      </div>
    </div>
  );
}

function OtherSection({
  track,
  after,
  lessons,
  onOpen,
}: {
  track: Track;
  after: Track;
  lessons: LessonSummary[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const first = lessons.find(
    (lesson) => lesson.status === 'available' || lesson.status === 'completed',
  );
  const premium = lessons.length > 0 && lessons.every((lesson) => lesson.status === 'premium');
  const body = (
    <>
      <b className="font-heading text-[18px] leading-6">{t(`tracks.${track}`)}</b>
      <span className="text-[14px] font-semibold text-text-2">
        {lessons.length > 0
          ? t('path.other.chapters', { count: lessons.length, after: t(`tracks.${after}`) })
          : t('path.other.soon')}
      </span>
    </>
  );
  if (first) {
    return (
      <button
        type="button"
        onClick={() => onOpen(first.id)}
        className="flex min-h-[112px] flex-col items-start gap-1 rounded-card border-2 border-edge bg-sky-tint p-4 text-left"
      >
        {body}
      </button>
    );
  }
  return (
    <div
      role="group"
      aria-label={`${t(`tracks.${track}`)}. ${premium ? t('path.other.premium') : t('path.locked')}`}
      className="flex min-h-[112px] flex-col items-start gap-1 rounded-card border-2 border-dashed border-dashed bg-surface p-4 text-text-2"
    >
      <LockIcon />
      {body}
    </div>
  );
}

/** The home screen: the ribbon of chapters of the current section, the cat, the puzzle of the day and the sections ahead. */
export function PathPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dark = useScheme() === 'dark';
  // Read in JS, like the navigation, so that only one of the two places for the cat's words exists
  const wide = useNavLayout() === 'full';
  const status = useAppSelector((state) => state.auth.status);
  const signedIn = status === 'authenticated';
  const lessons = useLessonsQuery(undefined, { skip: !signedIn });
  const daily = useDailyPuzzleQuery(localDateKey(), { skip: !signedIn });

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const catalog = lessons.data?.lessons ?? [];
  const tracks = TRACKS.filter((track) => catalog.some((lesson) => lesson.track === track));
  const current = catalog.find((lesson) => lesson.status === 'available');
  // The section being learned is the one with the chapter to do now, the last one when everything is done
  const track: Track | undefined = current?.track ?? tracks[tracks.length - 1];
  const items = catalog.filter((lesson) => lesson.track === track);
  const done = items.filter((lesson) => lesson.status === 'completed').length;
  const finished = items.length > 0 && done === items.length;
  const number = track ? TRACKS.indexOf(track) + 1 : 1;
  const others = TRACKS.filter((item) => item !== track);

  let bubble = '';
  if (current) {
    bubble = t(current.order === 1 ? 'path.bubble.first' : 'path.bubble.next', {
      title: current.title,
    });
  } else if (catalog.length > 0) {
    bubble = t('path.bubble.allDone');
  }
  const open = (id: string) => void navigate(`/lesson/${id}`);
  const about = track ? t(`path.sectionAbout.${track}`, { defaultValue: '' }) : '';

  return (
    <AppShell active="path" title={t('path.title')}>
      <StreakToast />
      <div className="flex max-w-[1200px] flex-col gap-8">
        {lessons.isError && (
          <div className="flex flex-col gap-3">
            <Banner>{t('path.loadError')}</Banner>
            <Button className="self-start" onClick={() => void lessons.refetch()}>
              {t('lesson.retryLoad')}
            </Button>
          </div>
        )}

        {lessons.isLoading && <Skeleton />}

        {track && (
          <section aria-labelledby={`track-${track}`} className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <span
                className={`flex size-14 items-center justify-center rounded-card border-2 border-edge ${finished ? 'bg-mint' : 'bg-brand'}`}
              >
                <img src={pieceUrl('w', 'k')} alt="" className="size-11" />
              </span>
              <div className="flex flex-col">
                <span className="text-[13px] font-extrabold tracking-[0.05em] text-text-2 uppercase">
                  {about
                    ? t('path.section', { n: number, about })
                    : t('path.sectionBare', { n: number })}
                </span>
                <h2 id={`track-${track}`} className="m-0 font-heading text-[24px] font-bold">
                  {t(`tracks.${track}`)}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 tablet:ml-auto">
                {finished && (
                  <span className="inline-flex min-h-8 items-center rounded-pill bg-mint-tint px-3.5 text-[14px] font-bold text-mint-text">
                    {t('path.sectionDone')}
                  </span>
                )}
                <div className="flex min-w-[240px] flex-col gap-1 tablet:w-[280px]">
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
            </div>

            <div className="flex flex-wrap items-end gap-[18px] pt-16 pb-3 laptop:flex-nowrap">
              <div className="flex min-w-0 flex-1 items-end gap-[18px] overflow-x-auto pr-2 pb-3">
                {items.map((lesson) => (
                  <ChapterCard
                    key={lesson.id}
                    lesson={lesson}
                    current={lesson.id === current?.id}
                    dark={dark}
                    onOpen={open}
                  />
                ))}
              </div>
              {bubble && wide && (
                <aside className="flex shrink-0 items-end gap-3">
                  <p className="m-0 max-w-[220px] rounded-card border-2 border-line bg-surface px-4 py-3 text-[15px] leading-[22px] font-semibold">
                    {bubble}
                  </p>
                  <Mascot mood={current ? 'wave' : 'proud'} size={140} dark={dark} animate />
                </aside>
              )}
            </div>
            {bubble && !wide && (
              <p className="m-0 rounded-card border-2 border-line bg-surface px-4 py-3 text-[15px] leading-[22px] font-semibold">
                {bubble}
              </p>
            )}
          </section>
        )}

        {catalog.length > 0 && (
          <div className="grid gap-[22px] tablet:grid-cols-2 laptop:grid-cols-[1.35fr_1fr_1fr_1fr]">
            {daily.data ? (
              <button
                type="button"
                onClick={() => void navigate('/puzzles')}
                className="flex min-h-[112px] items-center gap-4 rounded-card border-2 border-edge bg-sun-tint p-4 text-left shadow-shashka"
              >
                <PositionBoard fen={daily.data.fen} size={76} />
                <span className="flex flex-col gap-1">
                  <b className="text-[13px] font-extrabold text-sun-text uppercase">
                    {t('path.daily.title')}
                  </b>
                  <span className="font-heading text-[16px] leading-5 font-bold">
                    {daily.data.title}
                  </span>
                  {daily.data.solved && (
                    <span className="text-[13px] font-semibold text-text-2">
                      {t('path.daily.solved')}
                    </span>
                  )}
                </span>
              </button>
            ) : (
              <span />
            )}
            {others.slice(0, 3).map((item) => (
              <OtherSection
                key={item}
                track={item}
                after={track ?? 'basics'}
                lessons={catalog.filter((lesson) => lesson.track === item)}
                onOpen={open}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
