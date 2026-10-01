import { resolveMascot, type Accessory, type Mood, type ResolvedNode } from '@kotgambit/mascot';
import {
  createElement,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useReducedMotion } from '../../shared/useReducedMotion';

const DEFAULT_SIZE = 160;
const VIEW_BOX_SIZE = 200;
const BOB_DISTANCE = 3;
const BOB_DURATION_MS = 1200;
const JUMP_DISTANCE = 14;
const JUMP_DURATION_MS = 150;
const JUMP_COUNT = 2;

const ELEMENTS: Record<string, ComponentType<Record<string, unknown>>> = {
  g: G,
  path: Path,
  ellipse: Ellipse,
  circle: Circle,
  rect: Rect,
} as Record<string, ComponentType<Record<string, unknown>>>;

interface MascotProps {
  mood: Mood;
  size?: number;
  accessory?: Accessory;
  /** Light outline for dark backgrounds. */
  dark?: boolean;
  /** Bobbing, and the jump of the cheering cat. */
  animate?: boolean;
}

function renderNode(node: ResolvedNode, key: number): ReactNode {
  const element = ELEMENTS[node.tag];
  if (!element) throw new Error(`Unsupported rig element <${node.tag}>`);
  return createElement(
    element,
    { ...node.attrs, key },
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
  const reducedMotion = useReducedMotion();
  const [offset] = useState(() => new Animated.Value(0));
  const tree = useMemo(
    () => resolveMascot({ mood, accessory, dark, size }),
    [mood, accessory, dark, size],
  );

  useEffect(() => {
    offset.setValue(0);
    if (!animate || reducedMotion) return;
    const animation =
      mood === 'cheer'
        ? Animated.sequence(
            Array.from({ length: JUMP_COUNT }, () =>
              Animated.sequence([
                Animated.timing(offset, {
                  toValue: -JUMP_DISTANCE,
                  duration: JUMP_DURATION_MS,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
                Animated.timing(offset, {
                  toValue: 0,
                  duration: JUMP_DURATION_MS,
                  easing: Easing.in(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
            ),
          )
        : Animated.loop(
            Animated.sequence([
              Animated.timing(offset, {
                toValue: -BOB_DISTANCE,
                duration: BOB_DURATION_MS,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(offset, {
                toValue: 0,
                duration: BOB_DURATION_MS,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
          );
    animation.start();
    return () => animation.stop();
  }, [animate, reducedMotion, mood, offset]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ transform: [{ translateY: offset }] }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}>
        {tree.map((node, index) => renderNode(node, index))}
      </Svg>
    </Animated.View>
  );
}
