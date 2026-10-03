import type { Profile } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';

const DAYS_IN_WEEK = 7;
const GRAPH_WIDTH = 320;
const GRAPH_HEIGHT = 120;
const GRAPH_PADDING = 12;

/** Monday is the first day of the week in Russia, `getUTCDay` counts from Sunday. */
function mondayFirst(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;
}

/** The month as a calendar: the days that reached the goal are filled like the squares of the day bar. */
export function MonthCalendar({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const first = profile.month[0];
  if (!first) return null;
  const months = t('profile.calendar.months', { returnObjects: true }) as string[];
  const month = months[Number(first.day.slice(5, 7)) - 1] ?? '';

  return (
    <section className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[18px] font-extrabold">{month}</h2>
        <span className="text-[14px] font-bold text-flame-text">
          {t('profile.calendar.best', { count: profile.streak.best })}
        </span>
      </div>
      <ol className="m-0 grid list-none grid-cols-7 gap-1.5 p-0">
        {Array.from({ length: mondayFirst(first.day) }, (_, index) => (
          <li key={`gap-${index}`} aria-hidden="true" />
        ))}
        {profile.month.map((day) => {
          const number = Number(day.day.slice(8, 10));
          return (
            <li
              key={day.day}
              aria-label={`${t(day.done ? 'profile.calendar.done' : 'profile.calendar.missed', { day: number })}${day.today ? `, ${t('profile.calendar.today')}` : ''}`}
              className={`flex aspect-square items-center justify-center rounded-[8px] border-2 border-edge text-[13px] font-bold ${day.done ? 'bg-board-a text-on-brand' : 'bg-surface'} ${day.today ? 'ring-4 ring-brand' : ''}`}
            >
              <span aria-hidden="true">{number}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The puzzle rating over the last eight weeks as a line, with the change in words. */
export function RatingGraph({ history }: { history: Profile['ratingHistory'] }) {
  const { t } = useTranslation();
  const first = history[0];
  const last = history[history.length - 1];
  if (!first || !last) {
    return (
      <section className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface p-4">
        <h2 className="m-0 text-[18px] font-extrabold">{t('profile.rating.title')}</h2>
        <p className="m-0 text-[14px] font-semibold text-text-2">{t('profile.rating.none')}</p>
      </section>
    );
  }

  const ratings = history.map((point) => point.rating);
  const low = Math.min(...ratings);
  const spread = Math.max(...ratings) - low || 1;
  const step = (GRAPH_WIDTH - GRAPH_PADDING * 2) / Math.max(history.length - 1, 1);
  const points = history.map((point, index) => {
    const x = GRAPH_PADDING + index * step;
    const y =
      GRAPH_HEIGHT -
      GRAPH_PADDING -
      ((point.rating - low) / spread) * (GRAPH_HEIGHT - GRAPH_PADDING * 2);
    return { x, y };
  });
  const delta = last.rating - first.rating;

  return (
    <section className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[18px] font-extrabold">{t('profile.rating.title')}</h2>
        <span className="text-[14px] font-bold text-mint-text">
          {t('profile.rating.change', {
            sign: delta >= 0 ? '+' : '−',
            delta: Math.abs(delta),
          })}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        role="img"
        aria-label={t('profile.rating.label', { from: first.rating, to: last.rating })}
        className="w-full"
      >
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, index) => (
          <circle
            key={history[index]?.day}
            cx={p.x}
            cy={p.y}
            r={index === points.length - 1 ? 6 : 3.5}
            fill={index === points.length - 1 ? 'var(--color-sun)' : 'var(--color-surface)'}
            stroke="var(--color-edge)"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex justify-between text-[13px] font-bold text-text-2">
        <span>{first.rating}</span>
        <span>{last.rating}</span>
      </div>
    </section>
  );
}
