import type { Profile } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';

const DAYS_IN_WEEK = 7;

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

const RATING_WIDTH = 440;
const RATING_HEIGHT = 190;
// Room left for the numbers of the rating on the left and for the dates under the line
const PLOT = { left: 46, right: 18, top: 22, bottom: 34 };
const TICKS = 3;
// A rating that does not move is drawn in the middle with a little room around it
const FLAT_ROOM = 10;

/** `06.10` for the end of a week: the plain day and month are enough, the weeks are in a row. */
function shortDate(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

/**
 * The puzzle rating at the end of each of the last eight weeks: a line with the numbers on the left, the dates of the
 * weeks under it, the value over the last point, and a sentence that says what the picture is.
 */
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
  const rawLow = Math.min(...ratings);
  const rawHigh = Math.max(...ratings);
  // The scale starts a little below the lowest and ends a little above the highest, so that the line does not touch the edges
  const room = rawHigh === rawLow ? FLAT_ROOM : Math.max(1, Math.round((rawHigh - rawLow) * 0.15));
  const low = rawLow - room;
  const high = rawHigh + room;
  const plotWidth = RATING_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = RATING_HEIGHT - PLOT.top - PLOT.bottom;
  const xOf = (index: number) =>
    PLOT.left + (history.length > 1 ? (index / (history.length - 1)) * plotWidth : plotWidth / 2);
  const yOf = (rating: number) => PLOT.top + (1 - (rating - low) / (high - low)) * plotHeight;
  const points = history.map((point, index) => ({ x: xOf(index), y: yOf(point.rating) }));
  const ticks = Array.from({ length: TICKS }, (_, index) =>
    Math.round(low + ((high - low) * (TICKS - 1 - index)) / (TICKS - 1)),
  );
  const delta = last.rating - first.rating;
  const lastPoint = points[points.length - 1];

  return (
    <section className="flex flex-col gap-2 rounded-card border-2 border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[18px] font-extrabold">{t('profile.rating.title')}</h2>
        <span className={`text-[14px] font-bold ${delta >= 0 ? 'text-mint-text' : 'text-text-2'}`}>
          {t('profile.rating.change', {
            sign: delta >= 0 ? '+' : '−',
            delta: Math.abs(delta),
          })}
        </span>
      </div>
      <p className="m-0 text-[13px] font-semibold text-text-2">{t('profile.rating.caption')}</p>
      <svg
        viewBox={`0 0 ${RATING_WIDTH} ${RATING_HEIGHT}`}
        role="img"
        aria-label={t('profile.rating.label', { from: first.rating, to: last.rating })}
        className="w-full"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PLOT.left}
              x2={RATING_WIDTH - PLOT.right}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke="var(--color-line)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={PLOT.left - 8}
              y={yOf(tick) + 4}
              textAnchor="end"
              className="fill-text-2 text-[12px] font-bold"
            >
              {tick}
            </text>
          </g>
        ))}
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
          >
            <title>
              {t('profile.rating.point', {
                date: shortDate(history[index]?.day ?? ''),
                rating: history[index]?.rating,
              })}
            </title>
          </circle>
        ))}
        {lastPoint && (
          <text
            x={lastPoint.x}
            y={lastPoint.y - 12}
            textAnchor="end"
            className="fill-text text-[13px] font-extrabold"
          >
            {last.rating}
          </text>
        )}
        {history.map((point, index) => (
          <text
            key={point.day}
            x={xOf(index)}
            y={RATING_HEIGHT - 10}
            textAnchor="middle"
            className="fill-text-2 text-[11px] font-bold"
          >
            {shortDate(point.day)}
          </text>
        ))}
      </svg>
      <p className="m-0 text-[13px] font-semibold text-text-muted">{t('profile.rating.axis')}</p>
    </section>
  );
}
