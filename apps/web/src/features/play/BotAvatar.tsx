import type { BotProfile } from '@kotgambit/contracts';

const urls = import.meta.glob<string>('../../../../../assets/bots/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byKey = new Map(
  Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

export type BotMood = 'neutral' | 'win' | 'lose';

interface BotAvatarProps {
  kind: BotProfile['kind'];
  mood?: BotMood;
  size: number;
}

/** The bot's portrait. Decorative: the name next to it says who it is. */
export function BotAvatar({ kind, mood = 'neutral', size }: BotAvatarProps) {
  const url = byKey.get(`bot-${kind}-${mood}`);
  if (!url) throw new Error(`Missing bot asset bot-${kind}-${mood}`);
  return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full" />;
}
