import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shashka, size } from '../../theme/theme';

interface IconButtonProps {
  /** Required: an icon alone says nothing to TalkBack. */
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** The 52 dp "shashka" button or a quiet 48 dp one for toolbars. */
  quiet?: boolean;
}

export function IconButton({
  label,
  onPress,
  children,
  disabled = false,
  quiet = false,
}: IconButtonProps) {
  const { colors } = useTheme();

  if (quiet) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{
          width: size.tapMin,
          height: size.tapMin,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={{ paddingRight: shashka.offset, paddingBottom: shashka.offset }}>
      <View
        style={{
          position: 'absolute',
          left: shashka.offset,
          top: shashka.offset,
          right: 0,
          bottom: 0,
          borderRadius: radius.control,
          backgroundColor: colors.edge,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          width: size.buttonHeight,
          height: size.buttonHeight,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.control,
          borderWidth: shashka.border,
          borderColor: colors.edge,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.6 : 1,
          transform: pressed
            ? [{ translateX: shashka.pressShift }, { translateY: shashka.pressShift }]
            : [],
        })}
      >
        {children}
      </Pressable>
    </View>
  );
}
