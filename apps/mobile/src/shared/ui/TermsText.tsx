import { Trans } from 'react-i18next';
import { Linking, Text, type TextStyle } from 'react-native';
import { WEB_URL } from '../../app/api';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/theme';

const open = (path: string) => void Linking.openURL(`${WEB_URL}${path}`).catch(() => undefined);

/**
 * A line of text with links to the documents, which are read on the site. Write the places of the links
 * in the string as <offer>...</offer> and <privacy>...</privacy>.
 */
export function TermsText({ i18nKey, style }: { i18nKey: string; style?: TextStyle }) {
  const { colors } = useTheme();
  const link = { fontFamily: 'Onest-ExtraBold', color: colors.brandText };
  return (
    <Text style={[typography.caption, { color: colors.text2 }, style]}>
      <Trans
        i18nKey={i18nKey}
        components={{
          offer: <Text accessibilityRole="link" onPress={() => open('/offer')} style={link} />,
          privacy: <Text accessibilityRole="link" onPress={() => open('/privacy')} style={link} />,
        }}
      />
    </Text>
  );
}
