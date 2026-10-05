import type { OAuthProviderId } from '@kotgambit/contracts';
import { Image, Text, View } from 'react-native';
import googleIcon from './assets/google-g.png';

// Google: the official icon from its brand assets (Sign in with Google, light, square), used as it is. The files
// are 40x40 at 1x with @2x and @3x next to them, Google does not allow changing the logo, so it keeps its size.
const GOOGLE_SIZE = 40;
const MARK_SIZE = 32;

// Yandex and VK: the design calls their marks temporary on mobile (mobile/screens/entry.md). They are brand
// colors, not part of our palette, and they stand in until the official files of the two services are added
const MARKS = {
  yandex: { text: 'Я', background: '#FC3F1D', radius: MARK_SIZE / 2, fontSize: 16 },
  vk: { text: 'VK', background: '#0077FF', radius: 9, fontSize: 12 },
} as const;

/** The mark of a service on its button. The button has the label, so a screen reader skips this. */
export function ProviderIcon({ id }: { id: OAuthProviderId }) {
  if (id === 'google') {
    return (
      <Image
        accessible={false}
        source={googleIcon}
        style={{ width: GOOGLE_SIZE, height: GOOGLE_SIZE }}
      />
    );
  }
  const mark = MARKS[id];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: MARK_SIZE,
        height: MARK_SIZE,
        borderRadius: mark.radius,
        backgroundColor: mark.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontFamily: 'Onest-ExtraBold', fontSize: mark.fontSize }}>
        {mark.text}
      </Text>
    </View>
  );
}
