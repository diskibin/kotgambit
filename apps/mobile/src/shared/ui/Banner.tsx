import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/theme';

/** A calm coral notice with an icon and the next step, never a red alarm. */
export function Banner({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[3],
        padding: space[3],
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: colors.coralBorder,
        backgroundColor: colors.coralTint,
      }}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={{ marginTop: 2 }}>
        <Circle cx="12" cy="12" r="9" stroke={colors.coralText} strokeWidth={2.5} />
        <Path
          d="M12 7.5v5.5M12 16.5v.3"
          stroke={colors.coralText}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </Svg>
      <Text
        style={[typography.small, { flex: 1, color: colors.coralText, fontFamily: 'Onest-Bold' }]}
      >
        {children}
      </Text>
    </View>
  );
}
