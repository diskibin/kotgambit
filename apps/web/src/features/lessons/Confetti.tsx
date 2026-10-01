const COLORS = ['bg-sun', 'bg-mint', 'bg-sky', 'bg-coral', 'bg-brand'] as const;
const PIECES = 28;
const FALL_SECONDS = 1.5;

/**
 * Paper bits that fall once for 1.5 s. The positions come from the index, so the picture is the same
 * on every render. With reduced motion the bits simply sit where they would have landed.
 */
export function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: PIECES }, (_, index) => (
        <span
          key={index}
          className={`confetti-bit absolute top-0 block h-2.5 w-1.5 rounded-sm ${COLORS[index % COLORS.length]}`}
          style={{
            left: `${(index * 37) % 100}%`,
            animationDelay: `${(index % 7) * 0.08}s`,
            animationDuration: `${FALL_SECONDS}s`,
            transform: `rotate(${(index * 53) % 180}deg)`,
          }}
        />
      ))}
    </div>
  );
}
