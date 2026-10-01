const SEGMENTS = 4;

/** Four segments that fill up with the strength of a password, `mint` when filled. */
export function StrengthMeter({ filled }: { filled: number }) {
  return (
    <div aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <span
          key={index}
          className={`h-2 flex-1 rounded-pill ${index < filled ? 'bg-mint' : 'bg-line'}`}
        />
      ))}
    </div>
  );
}
