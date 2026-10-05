import type { OAuthProviderId } from '@kotgambit/contracts';
import { Image, Text, View } from 'react-native';
import googleIcon from './assets/google-g.png';

// Google: the "G" of its official brand assets (Sign in with Google), cut out of the 40x40 icon without its frame and
// used unchanged, at its own 20x20 (the @2x and @3x files are next to it). Google wants the G on white, so it sits on a
// white plate of the size of the other marks.
const GOOGLE_G_SIZE = 20;
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
      <View
        importantForAccessibility="no-hide-descendants"
        style={{
          width: MARK_SIZE,
          height: MARK_SIZE,
          borderRadius: 9,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          accessible={false}
          source={googleIcon}
          style={{ width: GOOGLE_G_SIZE, height: GOOGLE_G_SIZE }}
        />
      </View>
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
