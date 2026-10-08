import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { loadLessons } from './seed-lessons.js';

const FREE_DIR = fileURLToPath(new URL('../../../../content/lessons', import.meta.url));
const FREE_LESSON = join(FREE_DIR, 'endgame', '05-extra-material.yaml');

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kotgambit-private-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** A premium chapter made from a free one: synthetic, so no premium content is needed to test the loading. */
function writePremiumChapter(order: number, id = 'endgame-premium-fixture') {
  const lesson = parse(readFileSync(FREE_LESSON, 'utf8')) as Record<string, unknown>;
  mkdirSync(join(root, 'endgame'), { recursive: true });
  writeFileSync(
    join(root, 'endgame', `${order}-fixture.yaml`),
    stringify({ ...lesson, id, order, access: 'premium' }),
  );
}

describe('loadLessons', () => {
  it('reads the free lessons alone', () => {
    expect(loadLessons(FREE_DIR).length).toBeGreaterThan(0);
  });

  it('accepts premium chapters that continue the numbering of the free ones', () => {
    const free = loadLessons(FREE_DIR);
    writePremiumChapter(free.filter((lesson) => lesson.track === 'endgame').length + 1);

    const all = loadLessons([FREE_DIR, root]);

    expect(all).toHaveLength(free.length + 1);
    expect(all.find((lesson) => lesson.id === 'endgame-premium-fixture')?.access).toBe('premium');
  });

  it('refuses the private directory on its own, the numbering starts in the free one', () => {
    writePremiumChapter(
      loadLessons(FREE_DIR).filter((lesson) => lesson.track === 'endgame').length + 1,
    );
    expect(() => loadLessons(root)).toThrow(/chapter numbers must go 1, 2, 3/);
  });

  it('refuses a gap in the numbering and a duplicate id across the directories', () => {
    const freeEndgame = loadLessons(FREE_DIR).filter((lesson) => lesson.track === 'endgame').length;
    writePremiumChapter(freeEndgame + 4);
    const found = [...Array.from({ length: freeEndgame }, (_, i) => i + 1), freeEndgame + 4];
    expect(() => loadLessons([FREE_DIR, root])).toThrow(`found ${found.join(', ')}`);
    rmSync(join(root, 'endgame'), { recursive: true });
    writePremiumChapter(freeEndgame + 1, 'endgame-extra-material');
    expect(() => loadLessons([FREE_DIR, root])).toThrow(/duplicate lesson id/);
  });
});
