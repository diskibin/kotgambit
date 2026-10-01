import { describe, expect, it } from 'vitest';
import { MOODS, moodSpec, resolveMascot } from './index.js';
import type { ResolvedNode } from './types.js';

function flatten(nodes: ResolvedNode[]): ResolvedNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function layer(nodes: ResolvedNode[], name: string): ResolvedNode | undefined {
  return flatten(nodes).find((node) => node.layer === name);
}

const hasAttr = (nodes: ResolvedNode[], name: string, value: string) =>
  flatten(nodes).some((node) => node.attrs[name] === value);

describe('resolveMascot', () => {
  it('resolves every mood without leftovers from the source rig', () => {
    for (const mood of MOODS) {
      const nodes = flatten(resolveMascot({ mood }));
      expect(nodes.length).toBeGreaterThan(20);
      for (const node of nodes) {
        expect(Object.values(node.attrs)).not.toContain('$rim');
        expect(node.attrs).not.toHaveProperty('display');
        expect(node.attrs).not.toHaveProperty('data-state');
      }
    }
  });

  it('tilts the head and lifts the cat according to the mood', () => {
    expect(layer(resolveMascot({ mood: 'idle' }), 'head')?.attrs['transform']).toBe(
      'rotate(-4 100 130)',
    );
    expect(layer(resolveMascot({ mood: 'oops' }), 'head')?.attrs['transform']).toBe(
      'rotate(6 100 130)',
    );
    const cheer = resolveMascot({ mood: 'cheer' });
    expect(layer(cheer, 'jump')?.attrs['transform']).toBe('translate(0,-12)');
    expect(layer(cheer, 'shadow')?.attrs['rx']).toBe('40');
  });

  it('looks up and aside when thinking', () => {
    expect(layer(resolveMascot({ mood: 'thinking' }), 'pupils')?.attrs['transform']).toBe(
      'translate(2,-6)',
    );
  });

  it('puffs the chest when proud', () => {
    expect(layer(resolveMascot({ mood: 'proud' }), 'chest')?.attrs).toMatchObject({
      rx: '26',
      ry: '30',
    });
  });

  it('shows the mood effects and nothing of the others', () => {
    expect(hasAttr(resolveMascot({ mood: 'cheer' }), 'transform', 'rotate(15 44 12)')).toBe(true);
    expect(hasAttr(resolveMascot({ mood: 'idle' }), 'transform', 'rotate(15 44 12)')).toBe(false);
  });

  it('wraps the tail when sleepy and raises it otherwise', () => {
    const tailPath = (mood: 'sleepy' | 'idle') =>
      flatten(resolveMascot({ mood }))
        .filter((node) => node.layer === 'tail')
        .map((node) => node.children[0]?.attrs['d']);
    expect(tailPath('sleepy')).toEqual([expect.stringContaining('M136 172')]);
    expect(tailPath('idle')).toEqual([expect.stringContaining('M134 170')]);
  });

  it('uses the light outline on dark backgrounds', () => {
    expect(hasAttr(resolveMascot({ mood: 'idle', dark: true }), 'stroke', '#7A70C2')).toBe(true);
    expect(hasAttr(resolveMascot({ mood: 'idle' }), 'stroke', '#7A70C2')).toBe(false);
  });

  it('drops the whiskers when the cat is small', () => {
    expect(layer(resolveMascot({ mood: 'idle', size: 48 }), 'whiskers')).toBeUndefined();
    expect(layer(resolveMascot({ mood: 'idle', size: 96 }), 'whiskers')).toBeDefined();
  });

  it('swaps the bowtie for a scarf', () => {
    expect(layer(resolveMascot({ mood: 'idle' }), 'bowtie')).toBeDefined();
    const scarf = resolveMascot({ mood: 'idle', accessory: 'scarf' });
    expect(layer(scarf, 'bowtie')).toBeUndefined();
    expect(layer(scarf, 'acc-scarf')).toBeDefined();
  });

  it('adds exactly the requested accessory', () => {
    const crown = resolveMascot({ mood: 'idle', accessory: 'crown' });
    expect(layer(crown, 'acc-crown')).toBeDefined();
    expect(layer(crown, 'acc-hat')).toBeUndefined();
    expect(layer(resolveMascot({ mood: 'idle' }), 'acc-crown')).toBeUndefined();
  });
});

describe('moodSpec', () => {
  it('describes every mood', () => {
    for (const mood of MOODS) expect(moodSpec(mood).states.length).toBeGreaterThan(0);
  });
});
