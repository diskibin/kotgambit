import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import i18n from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { lightColors, screenPadding, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

const CAT = 170;

/**
 * Catches a screen that broke while drawing and says it in the voice of the cat. It sits above the theme and the
 * store, so it draws with the light colors and asks for nothing from them.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const t = i18n.t.bind(i18n);
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[3],
          padding: screenPadding,
          backgroundColor: lightColors.bg,
        }}
      >
        <Mascot mood="oops" size={CAT} />
        <Text
          accessibilityRole="header"
          style={[typography.h1, { color: lightColors.text, textAlign: 'center' }]}
        >
          {t('system.error.title')}
        </Text>
        <Text style={[typography.body, { color: lightColors.text2, textAlign: 'center' }]}>
          {t('system.error.text')}
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button
            large
            label={t('system.error.retry')}
            onPress={() => this.setState({ failed: false })}
          />
        </View>
      </View>
    );
  }
}
