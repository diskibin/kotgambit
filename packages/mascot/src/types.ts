export const MOODS = [
  'idle',
  'wave',
  'happy',
  'cheer',
  'thinking',
  'hint',
  'oops',
  'proud',
  'sleepy',
] as const;
export type Mood = (typeof MOODS)[number];

export const ACCESSORIES = ['none', 'scarf', 'glasses', 'crown', 'hat', 'medal'] as const;
export type Accessory = (typeof ACCESSORIES)[number];

/** A node of the source rig. `data-state` marks parts that only some moods show. */
export interface RigNode {
  tag: string;
  attrs: Record<string, string>;
  children?: RigNode[];
}

/** A node ready to draw: hidden parts are gone, colors and mood transforms are applied. */
export interface ResolvedNode {
  tag: string;
  attrs: Record<string, string>;
  /** The rig layer name (`eyes`, `tail`, `head`...), a hook for platform animations. */
  layer?: string;
  children: ResolvedNode[];
}

export interface MascotOptions {
  mood: Mood;
  accessory?: Accessory;
  /** Light outline for dark backgrounds. */
  dark?: boolean;
  /** Rendered size in px, the whiskers are dropped when the cat is too small for them. */
  size?: number;
}
