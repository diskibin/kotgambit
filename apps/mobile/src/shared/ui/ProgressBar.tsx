import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { shashka } from '../../theme/theme';

const HEIGHT = 16;

/** An outlined track with a `mint` fill. */
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const { colors } = useTheme();
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      style={{
        flex: 1,
        height: HEIGHT,
        overflow: 'hidden',
        borderRadius: HEIGHT,
        borderWidth: shashka.border,
        borderColor: colors.edge,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ width: `${percent}%`, height: '100%', backgroundColor: colors.mint }} />
    </View>
  );
}
