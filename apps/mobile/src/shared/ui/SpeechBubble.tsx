import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/theme';

/** The cat's remark when it has nothing to act on: a plain cloud with a thin outline and no shadow. */
export function SpeechBubble({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        padding: space[3],
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: colors.line,
        backgroundColor: colors.surface,
      }}
    >
      <Text
        style={{ fontFamily: 'Onest-SemiBold', fontSize: 15, lineHeight: 22, color: colors.text }}
      >
        {text}
      </Text>
    </View>
  );
}
