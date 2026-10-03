import Svg, { Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

// Paths from the design package (shared/assets/icons): 24x24 grid, 2.5 lines with round ends
function Stroke({ size = 24, color, d }: IconProps & { d: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const CheckIcon = (p: IconProps) => <Stroke {...p} d="M5 12.5l4.5 4.5L19 7.5" />;
export const BulbIcon = (p: IconProps) => (
  <Stroke
    {...p}
    d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"
  />
);
export const RetryIcon = (p: IconProps) => <Stroke {...p} d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />;
export const CloseIcon = (p: IconProps) => <Stroke {...p} d="M6 6l12 12M18 6L6 18" />;
export const LockIcon = (p: IconProps) => (
  <Stroke {...p} d="M5 10.5h14v10H5zM8 10.5V8a4 4 0 0 1 8 0v2.5" />
);
export const PauseIcon = (p: IconProps) => <Stroke {...p} d="M8 5v14M16 5v14" />;
export const SlidersIcon = (p: IconProps) => (
  <Stroke {...p} d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4" />
);
export const ChevronLeftIcon = (p: IconProps) => <Stroke {...p} d="M15 6l-6 6 6 6" />;
export const ChevronRightIcon = (p: IconProps) => <Stroke {...p} d="M9 6l6 6-6 6" />;

export function PlayIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5.5v13l10.5-6.5z" fill={color} />
    </Svg>
  );
}

export function StarIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"
        fill={color}
      />
    </Svg>
  );
}
