import { useTranslation } from 'react-i18next';
import { StatusBar, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { darkColors, lightColors, shashka, space } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

const CIRCLE = 176;
const CAT = 150;
// The splash has white text in both themes, the dark theme only swaps the purple for the page background
const SPLASH_TEXT = lightColors.onBrand;

/** Shown while the stored session is being checked. */
export function SplashScreen() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  return (
    <View
      accessibilityLabel={t('app.title')}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[3],
        backgroundColor: scheme === 'dark' ? darkColors.bg : colors.brand,
      }}
    >
      <StatusBar barStyle="light-content" />
      <View
        style={{
          width: CIRCLE + shashka.offsetLarge,
          height: CIRCLE + shashka.offsetLarge,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: shashka.offsetLarge,
            top: shashka.offsetLarge,
            width: CIRCLE,
            height: CIRCLE,
            borderRadius: CIRCLE,
            backgroundColor: colors.edge,
          }}
        />
        <View
          style={{
            width: CIRCLE,
            height: CIRCLE,
            borderRadius: CIRCLE,
            borderWidth: shashka.borderLarge,
            borderColor: colors.edge,
            backgroundColor: scheme === 'dark' ? colors.brandTint : colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mascot mood="wave" size={CAT} dark={scheme === 'dark'} />
        </View>
      </View>
      <Text style={{ fontFamily: 'Unbounded-Bold', fontSize: 30, color: SPLASH_TEXT }}>
        {t('app.title')}
      </Text>
      <Text style={{ fontFamily: 'Onest-SemiBold', fontSize: 16, color: SPLASH_TEXT }}>
        {t('splash.subtitle')}
      </Text>
    </View>
  );
}
