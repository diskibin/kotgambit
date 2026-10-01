import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../useReducedMotion';

const TURN_MS = 800;

export function Spinner({ color, size = 22 }: { color: string; size?: number }) {
  const reduced = useReducedMotion();
  const [angle] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(angle, {
        toValue: 1,
        duration: TURN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [angle, reduced]);

  const rotate = angle.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3a9 9 0 1 0 9 9" stroke={color} strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
