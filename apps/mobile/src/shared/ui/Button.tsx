import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shashka, size, typography } from '../../theme/theme';

type Variant = 'primary' | 'secondary' | 'text';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** The main button of a screen is 56 dp high and sits in the thumb zone. */
  large?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  large = false,
  disabled = false,
  busy = false,
  icon,
}: ButtonProps) {
  const { colors } = useTheme();
  const height = large ? size.buttonHeightL : size.buttonHeight;

  if (variant === 'text') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{ minHeight: size.tapMin, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={[typography.button, { color: colors.brandText }]}>{label}</Text>
      </Pressable>
    );
  }

  const background = variant === 'primary' ? colors.brand : colors.surface;
  const foreground = variant === 'primary' ? colors.onBrand : colors.text;

  // "Shashka": a second view in the outline colour sits under the button, offset to the bottom right.
  // Not elevation or shadow*, which blur and differ between devices.
  return (
    <View style={styles.wrap}>
      <View
        style={[styles.underlay, { backgroundColor: colors.edge, borderRadius: radius.card }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            height,
            backgroundColor: background,
            borderColor: colors.edge,
            opacity: disabled ? 0.85 : 1,
            transform: pressed
              ? [{ translateX: shashka.pressShift }, { translateY: shashka.pressShift }]
              : [],
          },
        ]}
      >
        {icon}
        <Text style={[typography.button, { color: foreground, fontSize: large ? 18 : 16 }]}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Room on the right and at the bottom for the offset underlay
  wrap: { paddingRight: shashka.offset, paddingBottom: shashka.offset },
  underlay: {
    position: 'absolute',
    left: shashka.offset,
    top: shashka.offset,
    right: 0,
    bottom: 0,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: shashka.border,
  },
});
