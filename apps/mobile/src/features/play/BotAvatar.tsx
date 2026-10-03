import type { BotProfile } from '@kotgambit/contracts';
import { memo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { BOT_XML } from './botXml';

export type BotMood = 'neutral' | 'win' | 'lose';

interface BotAvatarProps {
  kind: BotProfile['kind'];
  mood?: BotMood;
  size: number;
}

/** The bot's portrait. Decorative: the name next to it says who it is. */
export const BotAvatar = memo(function BotAvatar({ kind, mood = 'neutral', size }: BotAvatarProps) {
  const xml = BOT_XML[`bot-${kind}-${mood}`];
  if (!xml) throw new Error(`Missing bot asset bot-${kind}-${mood}`);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
});
