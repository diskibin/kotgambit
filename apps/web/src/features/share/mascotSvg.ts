import { resolveMascot, type Accessory, type Mood, type ResolvedNode } from '@kotgambit/mascot';

const NAMESPACE = 'http://www.w3.org/2000/svg';
const VIEW_BOX = 200;

// The rig keeps React names (strokeWidth), a file of its own needs the SVG ones (stroke-width)
const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function serialize(node: ResolvedNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([name, value]) => ` ${kebab(name)}="${escapeAttribute(value)}"`)
    .join('');
  const children = node.children.map(serialize).join('');
  return `<${node.tag}${attrs}>${children}</${node.tag}>`;
}

/** The cat as the text of a standalone SVG file, so that it can be drawn on a canvas as an image. */
export function mascotSvg(options: {
  mood: Mood;
  accessory: Accessory;
  dark: boolean;
  size: number;
}): string {
  const tree = resolveMascot(options);
  return (
    `<svg xmlns="${NAMESPACE}" width="${options.size}" height="${options.size}" ` +
    `viewBox="0 0 ${VIEW_BOX} ${VIEW_BOX}">${tree.map(serialize).join('')}</svg>`
  );
}
