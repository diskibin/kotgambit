import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, size, space, typography } from '../../theme/theme';

const LABEL_FONT = 'Onest-ExtraBold';

interface TextFieldProps extends Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'keyboardType'
  | 'autoCapitalize'
  | 'autoComplete'
  | 'secureTextEntry'
  | 'returnKeyType'
  | 'onSubmitEditing'
> {
  label: string;
  /** Replaces the hint and turns the field coral: a mistake is explained, never shouted. */
  error?: ReactNode;
  hint?: string;
  /** Marks the field coral without a message of its own, for an error explained elsewhere. */
  invalid?: boolean;
  disabled?: boolean;
  /** A control inside the right edge of the field, such as the eye of a password field. */
  endAdornment?: ReactNode;
}

export function TextField({
  label,
  error,
  hint,
  invalid = false,
  disabled = false,
  endAdornment,
  ...input
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const failed = invalid || Boolean(error);
  const message = error ?? hint;

  const borderColor = failed ? colors.coral : focused ? colors.brand : colors.line;
  const backgroundColor = failed ? colors.coralTint : disabled ? colors.disabledBg : colors.surface;

  return (
    <View style={{ gap: space[2] }}>
      <Text style={[typography.small, { fontFamily: LABEL_FONT, color: colors.text }]}>
        {label}
      </Text>
      <View>
        <TextInput
          {...input}
          accessibilityLabel={label}
          editable={!disabled}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              borderColor,
              backgroundColor,
              borderWidth: focused && !failed ? 3 : 2,
              color: colors.text,
              fontFamily: 'Onest-SemiBold',
            },
          ]}
        />
        {endAdornment && <View style={styles.adornment}>{endAdornment}</View>}
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={[typography.small, { color: error ? colors.coralText : colors.text2 }]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: size.input,
    borderRadius: radius.input,
    paddingLeft: 16,
    paddingRight: 56,
    fontSize: 16,
  },
  adornment: { position: 'absolute', right: 4, top: 2 },
});
