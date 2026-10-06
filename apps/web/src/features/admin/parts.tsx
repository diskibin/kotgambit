import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Banner } from '../../shared/ui/Banner';
import { Button } from '../../shared/ui/Button';
import { formatCount, percentOf } from './format';

const PERCENT_MAX = 100;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4">
      <h2 className="m-0 text-[18px] font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[14px] font-semibold text-text-2">{children}</p>;
}

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border-2 border-line bg-surface-2 p-3">
      <span className="text-[13px] font-extrabold tracking-[0.05em] text-text-2 uppercase">
        {label}
      </span>
      <span className="font-heading text-[24px] leading-8 font-bold">{value}</span>
      {sub && <span className="text-[13px] font-semibold text-text-muted">{sub}</span>}
    </div>
  );
}

export function Tiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 desktop:grid-cols-3">{children}</div>;
}

export interface FunnelStep {
  key: string;
  label: string;
  value: number;
}

/**
 * Steps as bars, each against the first one. `shareText` says what the share is of; the share of the
 * step before follows it, which is where the funnel leaks.
 */
export function FunnelBars({
  steps,
  shareText,
}: {
  steps: readonly FunnelStep[];
  shareText: (percent: number) => string;
}) {
  const { t } = useTranslation();
  const base = steps[0]?.value ?? 0;
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {steps.map((step, index) => {
        const previous = index === 0 ? null : (steps[index - 1]?.value ?? 0);
        const share = percentOf(step.value, base);
        return (
          <li key={step.key} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[15px] font-bold">{step.label}</span>
              <span className="text-[15px] font-extrabold">{formatCount(step.value)}</span>
            </div>
            <div
              role="progressbar"
              aria-label={step.label}
              aria-valuemin={0}
              aria-valuemax={base}
              aria-valuenow={step.value}
              className="h-3 overflow-hidden rounded-pill bg-surface-2"
            >
              <div
                style={{ width: `${Math.min(share, PERCENT_MAX)}%` }}
                className="h-full bg-brand"
              />
            </div>
            {previous !== null && (
              <span className="text-[13px] font-semibold text-text-2">
                {shareText(share)}
                {' · '}
                {t('admin.funnel.fromPrevious', { percent: percentOf(step.value, previous) })}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A table that scrolls sideways on a narrow screen instead of squeezing the numbers. */
export function DataTable({ head, children }: { head: readonly string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr>
            {head.map((title) => (
              <th
                key={title}
                scope="col"
                className="border-b-2 border-line px-2 py-2 text-[13px] font-extrabold text-text-2"
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <td
      className={`border-b border-line px-2 py-2 align-top ${strong ? 'font-extrabold' : 'font-semibold'}`}
    >
      {children}
    </td>
  );
}

export function statusOf(error: unknown): number | null {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: unknown }).status)
    : null;
}

interface QueryLike<T> {
  data?: T | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

/** The loading note, or the error with a way to try again, or the data. */
export function Loaded<T>({
  query,
  children,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      {query.isError && (
        <div className="flex flex-col gap-3">
          <Banner>{t('admin.loadError')}</Banner>
          <Button className="self-start" onClick={() => void query.refetch()}>
            {t('admin.retry')}
          </Button>
        </div>
      )}
      {query.isLoading && (
        <p role="status" className="m-0 text-[16px] font-bold text-text-2">
          {t('admin.loading')}
        </p>
      )}
      {query.data !== undefined && children(query.data)}
    </>
  );
}
