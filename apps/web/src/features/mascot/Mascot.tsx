import { resolveMascot, type Accessory, type Mood, type ResolvedNode } from '@kotgambit/mascot';
import { createElement, type ReactNode } from 'react';
import './mascot.css';

const DEFAULT_SIZE = 160;

interface MascotProps {
  mood: Mood;
  size?: number;
  accessory?: Accessory;
  /** Light outline for dark backgrounds. */
  dark?: boolean;
  /** Idle animations: blinking, tail, bobbing. Off by default, the cat in a list stays still. */
  animate?: boolean;
}

function renderNode(node: ResolvedNode, key: number): ReactNode {
  const props = { ...node.attrs, key, ...(node.layer ? { 'data-layer': node.layer } : {}) };
  return createElement(
    node.tag,
    props,
    ...node.children.map((child, index) => renderNode(child, index)),
  );
}

// The cat is decorative: every reply it gives is also written out in text next to it
export function Mascot({
  mood,
  size = DEFAULT_SIZE,
  accessory = 'none',
  dark = false,
  animate = false,
}: MascotProps) {
  const tree = resolveMascot({ mood, accessory, dark, size });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
      data-mood={mood}
      className={animate ? 'mascot mascot--animate' : 'mascot'}
    >
      {tree.map((node, index) => renderNode(node, index))}
    </svg>
  );
}
