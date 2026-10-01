import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

// Paths from the design package (shared/assets/icons): 24x24 grid, 2.5 lines with round ends, currentColor
function Stroke({ size = 24, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Stroke>
);

export const BulbIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
  </Stroke>
);

export const RetryIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />
  </Stroke>
);

export const CloseIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
);

export const LockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 10.5h14v10H5zM8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Stroke>
);

export const UndoIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
  </Stroke>
);

export const PauseIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M8 5v14M16 5v14" />
  </Stroke>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Stroke>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 6l6 6-6 6" />
  </Stroke>
);

export const PlayIcon = ({ size = 24, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
);

export const StarIcon = ({ size = 24, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  </svg>
);
