interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
}

/** An outlined track with a `mint` fill. */
export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-4 flex-1 overflow-hidden rounded-pill border-2 border-edge bg-surface"
    >
      <div
        style={{ width: `${percent}%` }}
        className="h-full bg-mint transition-[width] duration-pop ease-out motion-reduce:transition-none"
      />
    </div>
  );
}
