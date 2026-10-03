import { TRACKS } from '@kotgambit/content-schema';
import type { LessonSummary } from '@kotgambit/contracts';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useDailyPuzzleQuery, useLessonsQuery } from '../../app/api';
import { useAppSelector } from '../../app/hooks';
import { localDateKey } from '../../shared/localDate';
import { AppShell } from '../../shared/ui/AppShell';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { useNavLayout } from '../../shared/useNavLayout';
import { pieceUrl } from '../board/pieceAssets';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { ChapterCard } from './ChapterCard';
import { PositionBoard } from './PositionBoard';
import { StreakToast } from './StreakToast';

const PERCENT = 100;
const SKELETON_CARDS = 4;
const OTHER_PIECE = { openings: 'n', middlegame: 'b', endgame: 'r', basics: 'k' } as const;

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
            className="h-60 w-[200px] shrink-0 animate-pulse rounded-chapter border-2 border-dashed border-[color:var(--color-dashed)] bg-surface motion-reduce:animate-none"
          />
        ))}
        <div className="flex flex-col items-start gap-1">
          <p className="relative m-0 max-w-[220px] rounded-[16px] border-2 border-line bg-surface px-3.5 py-2.5 text-[15px] leading-[22px] font-semibold">
            <b>{t('path.loadingTitle')}</b>
            <br />
            {t('path.loading')}
            <span
              aria-hidden="true"
              className="absolute -bottom-2.5 left-7 size-4 rotate-45 border-r-2 border-b-2 border-line bg-surface"
            />
          </p>
          <Mascot mood="thinking" size={110} dark={dark} />
        </div>
      </div>
    </div>
  );
}

/** The cat and what it says: the words are in a bubble over its head, the tail points down to it. */
function CatSays({ text, mood, dark }: { text: string; mood: 'wave' | 'proud'; dark: boolean }) {
  return (
    <aside className="ml-1 flex shrink-0 flex-col items-start gap-1">
      <p className="relative m-0 max-w-[220px] rounded-[16px] border-2 border-line bg-surface px-3.5 py-2.5 text-[15px] leading-[22px] font-semibold">
        {text}
        <span
          aria-hidden="true"
          className="absolute -bottom-2.5 left-7 size-4 rotate-45 border-r-2 border-b-2 border-line bg-surface"
        />
      </p>
      <Mascot mood={mood} size={140} dark={dark} animate />
    </aside>
  );
}

function OtherSection({
  track,
  lessons,
  note,
  onOpen,
}: {
  track: Track;
  lessons: LessonSummary[];
  /** Under the name of an open section, in place of the count. */
  note: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const first = lessons.find(
    (lesson) => lesson.status === 'available' || lesson.status === 'completed',
  );
  const body = (
    <>
      <img src={pieceUrl('w', OTHER_PIECE[track])} alt="" className="size-12 shrink-0" />
      <span className="flex flex-1 flex-col">
        <b className="font-heading text-[17px] leading-6 font-bold">{t(`tracks.${track}`)}</b>
        <span className="text-[13px] font-semibold">{note}</span>
      </span>
    </>
  );
  if (first) {
    return (
      <button
        type="button"
        onClick={() => onOpen(first.id)}
        className="flex items-center gap-3 rounded-chapter border-2 border-edge bg-sky px-4 py-3.5 text-left text-on-accent"
      >
        {body}
      </button>
    );
  }
  return (
    <div
      role="group"
      aria-label={`${t(`tracks.${track}`)}. ${t('path.locked')}`}
      className="flex items-center gap-3 rounded-chapter border-2 border-dashed border-[color:var(--color-dashed)] bg-surface px-4 py-3.5 text-text"
    >
      {body}
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="10.5" width="14" height="10" rx="3" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </svg>
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
  const [showAll, setShowAll] = useState(false);
  const ribbon = useRef<HTMLDivElement>(null);
  const currentId = lessons.data?.lessons.find((lesson) => lesson.status === 'available')?.id;

  // The chapter to do now is in view when the screen opens, however far down the section it is
  useEffect(() => {
    const strip = ribbon.current;
    const card = strip?.querySelector<HTMLElement>('[data-current]');
    if (strip && card)
      strip.scrollLeft = card.offsetLeft - (strip.clientWidth - card.offsetWidth) / 2;
  }, [currentId]);

  if (status === 'anonymous') return <Navigate to="/login" replace />;

  const catalog = lessons.data?.lessons ?? [];
  const tracks = TRACKS.filter((track) => catalog.some((lesson) => lesson.track === track));
  const current = catalog.find((lesson) => lesson.status === 'available');
  // The section being learned is the one with the chapter to do now, the last one when everything is done
  const track: Track | undefined = current?.track ?? tracks[tracks.length - 1];
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

  function renderSection(section: Track) {
    const items = catalog.filter((lesson) => lesson.track === section);
    const done = items.filter((lesson) => lesson.status === 'completed').length;
    const finished = items.length > 0 && done === items.length;
    const percent = Math.round((done / items.length) * PERCENT);
    const about = t(`path.sectionAbout.${section}`, { defaultValue: '' });
    const number = TRACKS.indexOf(section) + 1;
    return (
      <section key={section} aria-labelledby={`track-${section}`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={`flex size-14 shrink-0 items-center justify-center rounded-card border-2 border-edge ${finished ? 'bg-mint' : 'bg-brand'}`}
          >
            <img src={pieceUrl('w', 'k')} alt="" className="size-11" />
          </span>
          <div className="flex min-w-[200px] flex-1 flex-col">
            <span className="text-[13px] font-bold tracking-[0.06em] text-text-2 uppercase">
              {about
                ? t('path.section', { n: number, about })
                : t('path.sectionBare', { n: number })}
            </span>
            <h2
              id={`track-${section}`}
              className="m-0 font-heading text-[24px] leading-8 font-bold"
            >
              {t(`tracks.${section}`)}
            </h2>
          </div>
          {finished && (
            <span className="flex h-[34px] items-center gap-1.5 rounded-pill border-2 border-mint-border bg-mint-tint px-3 text-[14px] font-bold text-mint-text">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              {t('path.sectionDone')}
            </span>
          )}
          <div className="flex w-[280px] max-w-full flex-col gap-1">
            <div className="flex justify-between text-[13px] font-bold">
              <span>{t('path.progressCount', { done, total: items.length })}</span>
              <span className="text-text-2">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={t('path.progressBar')}
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={done}
              className="h-3 overflow-hidden rounded-pill border-2 border-edge bg-surface"
            >
              <div style={{ width: `${percent}%` }} className="h-full bg-mint" />
            </div>
          </div>
          {section === track && tracks.length > 1 && (
            <button
              type="button"
              aria-pressed={showAll}
              onClick={() => setShowAll(!showAll)}
              className="flex min-h-11 items-center text-[15px] font-bold text-brand-text"
            >
              {t('path.allChapters')}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-[18px] pt-2 pb-3 laptop:flex-nowrap">
          <div
            ref={section === track ? ribbon : undefined}
            className="flex min-w-0 flex-1 items-end gap-[18px] overflow-x-auto pr-2 pb-3"
          >
            {items.map((lesson) => (
              <ChapterCard
                key={lesson.id}
                lesson={lesson}
                current={lesson.id === current?.id}
                onOpen={open}
              />
            ))}
          </div>
          {section === track && bubble && wide && (
            <CatSays text={bubble} mood={current ? 'wave' : 'proud'} dark={dark} />
          )}
        </div>
        {section === track && bubble && !wide && (
          <CatSays text={bubble} mood={current ? 'wave' : 'proud'} dark={dark} />
        )}
      </section>
    );
  }

  return (
    <AppShell active="path" title={t('path.title')}>
      <StreakToast />
      <div className="flex min-w-0 flex-col gap-[22px]">
        {lessons.isError && (
          <div className="flex flex-col gap-3">
            <Banner>{t('path.loadError')}</Banner>
            <Button className="self-start" onClick={() => void lessons.refetch()}>
              {t('lesson.retryLoad')}
            </Button>
          </div>
        )}

        {lessons.isLoading && <Skeleton />}

        {track && (showAll ? tracks : [track]).map(renderSection)}

        {catalog.length > 0 && (
          <section
            aria-label={t('path.daily.title')}
            className="grid gap-[18px] tablet:grid-cols-2 laptop:grid-cols-[1.35fr_1fr_1fr_1fr]"
          >
            {daily.data ? (
              <button
                type="button"
                onClick={() => void navigate('/puzzles')}
                className="flex items-center gap-3.5 rounded-chapter border-2 border-edge bg-sun-tint px-4 py-3.5 text-left shadow-shashka"
              >
                <PositionBoard fen={daily.data.fen} size={76} />
                <span className="flex flex-col gap-0.5">
                  <b className="text-[12px] font-extrabold tracking-[0.06em] text-sun-text uppercase">
                    {t('path.daily.title')}
                  </b>
                  <span className="font-heading text-[17px] leading-6 font-bold">
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
            {others.slice(0, 3).map((item, index) => {
              const lessonsOf = catalog.filter((lesson) => lesson.track === item);
              const note =
                lessonsOf.length === 0
                  ? t('path.other.soon')
                  : index === 0 && track
                    ? t('path.other.chapters', {
                        count: lessonsOf.length,
                        after: t(`path.afterTrack.${track}`),
                      })
                    : t('path.other.count', { count: lessonsOf.length });
              return (
                <OtherSection
                  key={item}
                  track={item}
                  lessons={lessonsOf}
                  note={note}
                  onOpen={open}
                />
              );
            })}
          </section>
        )}
      </div>
    </AppShell>
  );
}
