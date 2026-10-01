import { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../shared/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';

const PIECES = 24;
const FALL_MS = 1500;
const BIT_WIDTH = 6;
const BIT_HEIGHT = 10;

/**
 * Paper bits that fall once for 1.5 s. The positions come from the index, so the picture is the same
 * on every render. With reduced motion the bits sit where they would have landed.
 */
export function Confetti() {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const { width, height } = Dimensions.get('window');
  const palette = [colors.sun, colors.mint, colors.sky, colors.coral, colors.brand];

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: FALL_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const fall = progress.interpolate({ inputRange: [0, 1], outputRange: [-20, height * 0.5] });

  return (
    <>
      {Array.from({ length: PIECES }, (_, index) => (
        <Animated.View
          key={index}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[
            styles.bit,
            {
              left: ((index * 37) % 100) * (width / 100),
              backgroundColor: palette[index % palette.length],
              transform: [{ translateY: fall }, { rotate: `${(index * 53) % 180}deg` }],
            },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', top: 0, width: BIT_WIDTH, height: BIT_HEIGHT, borderRadius: 2 },
});
