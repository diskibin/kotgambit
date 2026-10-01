import { RIG, RIM } from './rig.js';
import type { Accessory, MascotOptions, Mood, ResolvedNode, RigNode } from './types.js';

const RIM_LIGHT = '#1E1A2F';
const RIM_DARK = '#7A70C2';
// Below this size the whiskers turn into noise
const MIN_WHISKERS_SIZE = 64;

interface MoodSpec {
  states: string[];
  /** Head tilt in degrees. */
  headTilt: number;
  /** Vertical offset of the whole body, negative is up. */
  lift: number;
  shadowRx: number;
  chest: { rx: number; ry: number };
  pupils: { x: number; y: number };
}

const DEFAULT_SPEC = {
  headTilt: -4,
  lift: 0,
  shadowRx: 52,
  chest: { rx: 22, ry: 26 },
  pupils: { x: 0, y: 0 },
};

const MOOD_SPECS: Record<Mood, MoodSpec> = {
  idle: { ...DEFAULT_SPEC, states: ['eyes-open', 'mouth-w', 'tail-up'] },
  wave: {
    ...DEFAULT_SPEC,
    states: ['eyes-open', 'mouth-open', 'paw-wave', 'tail-up', 'blush'],
  },
  happy: { ...DEFAULT_SPEC, states: ['eyes-happy', 'mouth-open', 'tail-up', 'blush'] },
  cheer: {
    ...DEFAULT_SPEC,
    states: ['eyes-happy', 'mouth-open', 'paws-up', 'fx-confetti', 'tail-up', 'blush'],
    lift: -12,
    shadowRx: 40,
  },
  thinking: {
    ...DEFAULT_SPEC,
    states: ['eyes-open', 'mouth-flat', 'paw-chin', 'fx-think', 'tail-up'],
    pupils: { x: 2, y: -6 },
  },
  hint: {
    ...DEFAULT_SPEC,
    states: ['eyes-open', 'mouth-w', 'paw-hint', 'fx-bulb', 'tail-up'],
  },
  oops: {
    ...DEFAULT_SPEC,
    states: ['eyes-open', 'mouth-wavy', 'brows', 'tail-up'],
    headTilt: 6,
  },
  proud: {
    ...DEFAULT_SPEC,
    states: ['eyes-proud', 'mouth-w', 'fx-sparkle', 'tail-up', 'blush'],
    headTilt: 4,
    chest: { rx: 26, ry: 30 },
  },
  sleepy: {
    ...DEFAULT_SPEC,
    states: ['eyes-closed', 'mouth-flat', 'tail-wrap', 'fx-zzz'],
    headTilt: -10,
  },
};

const HEAD_PIVOT = '100 130';

export function moodSpec(mood: Mood): MoodSpec {
  return MOOD_SPECS[mood];
}

function visibleStates(mood: Mood, accessory: Accessory, size: number): Set<string> {
  const states = new Set(MOOD_SPECS[mood].states);
  if (size >= MIN_WHISKERS_SIZE) states.add('whiskers');
  if (accessory === 'scarf') states.add('acc-scarf');
  else states.add('bowtie');
  if (accessory !== 'none' && accessory !== 'scarf') states.add(`acc-${accessory}`);
  return states;
}

function resolveNode(
  node: RigNode,
  states: Set<string>,
  rim: string,
  mood: Mood,
): ResolvedNode | null {
  const state = node.attrs['data-state'];
  if (state !== undefined && !states.has(state)) return null;

  const spec = MOOD_SPECS[mood];
  const attrs: Record<string, string> = {};
  for (const [name, value] of Object.entries(node.attrs)) {
    if (name === 'display' || name === 'data-state' || name === 'data-layer') continue;
    attrs[name] = value === RIM ? rim : value;
  }

  const layer = node.attrs['data-layer'];
  switch (layer) {
    case 'head':
      attrs['transform'] = `rotate(${spec.headTilt} ${HEAD_PIVOT})`;
      break;
    case 'jump':
      attrs['transform'] = `translate(0,${spec.lift})`;
      break;
    case 'pupils':
      attrs['transform'] = `translate(${spec.pupils.x},${spec.pupils.y})`;
      break;
    case 'shadow':
      attrs['rx'] = String(spec.shadowRx);
      break;
    case 'chest':
      attrs['rx'] = String(spec.chest.rx);
      attrs['ry'] = String(spec.chest.ry);
      break;
  }

  const children = (node.children ?? [])
    .map((child) => resolveNode(child, states, rim, mood))
    .filter((child): child is ResolvedNode => child !== null);
  return { tag: node.tag, attrs, ...(layer ? { layer } : {}), children };
}

/** The cat for one mood, as a tree that platform renderers turn into SVG elements. */
export function resolveMascot({
  mood,
  accessory = 'none',
  dark = false,
  size = 240,
}: MascotOptions): ResolvedNode[] {
  const states = visibleStates(mood, accessory, size);
  const rim = dark ? RIM_DARK : RIM_LIGHT;
  return RIG.map((node) => resolveNode(node, states, rim, mood)).filter(
    (node): node is ResolvedNode => node !== null,
  );
}
