import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { constants, zstdCompressSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readLines, zstdFrameRanges } from './zstd-frames.js';

/** A skippable frame: any of the 16 magic numbers 0x184D2A50..5F, then the size and the payload. */
function skippable(payload: string, magicLow = 0): Buffer {
  const data = Buffer.from(payload);
  const header = Buffer.alloc(8);
  header.writeUInt32LE(0x184d2a50 + magicLow, 0);
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data]);
}

async function collect(path: string): Promise<string[]> {
  const lines: string[] = [];
  for await (const line of readLines(path)) lines.push(line);
  return lines;
}

describe('zstd frames', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kotgambit-zstd-'));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  const write = async (name: string, ...parts: Buffer[]) => {
    const path = join(dir, name);
    await writeFile(path, Buffer.concat(parts));
    return path;
  };
  const frame = (text: string) => zstdCompressSync(Buffer.from(text));

  it('reads a plain file with Windows line endings', async () => {
    const path = await write('plain.csv', Buffer.from('a,b\r\n1,2\r\n3,4'));
    expect(await collect(path)).toEqual(['a,b', '1,2', '3,4']);
  });

  it('reads a single frame', async () => {
    const path = await write('one.csv.zst', frame('header\nrow1\nrow2\n'));
    expect(await collect(path)).toEqual(['header', 'row1', 'row2']);
  });

  it('skips a skippable frame at the start and between frames, as in the Lichess file', async () => {
    const path = await write(
      'skip.csv.zst',
      skippable('meta'),
      frame('header\nrow1\n'),
      skippable('more metadata', 5),
      frame('row2\nrow3\n'),
    );
    expect(await collect(path)).toEqual(['header', 'row1', 'row2', 'row3']);
    expect(await zstdFrameRanges(path)).toHaveLength(2);
  });

  it('joins a line that is cut between two frames', async () => {
    const path = await write('cut.csv.zst', frame('header\nrow-'), frame('one\nrow2\n'));
    expect(await collect(path)).toEqual(['header', 'row-one', 'row2']);
  });

  it('keeps a multibyte character that is split between chunks', async () => {
    const text = `${'я'.repeat(200_000)}\nконец\n`;
    const path = await write('utf8.csv.zst', frame(text));
    expect(await collect(path)).toEqual(['я'.repeat(200_000), 'конец']);
  });

  it('walks past a large frame of many blocks, with and without a checksum', async () => {
    const big = Array.from({ length: 60_000 }, (_, i) => `line ${i}`).join('\n') + '\n';
    const path = await write(
      'big.csv.zst',
      zstdCompressSync(Buffer.from(big), { params: { [constants.ZSTD_c_checksumFlag]: 1 } }),
      frame('tail\n'),
    );
    const lines = await collect(path);
    expect(lines).toHaveLength(60_001);
    expect(lines.at(-1)).toBe('tail');
    expect(await zstdFrameRanges(path)).toHaveLength(2);
  });

  it('rejects a file that is not zstd', async () => {
    const path = await write('bad.csv.zst', Buffer.from('this is not compressed'));
    await expect(zstdFrameRanges(path)).rejects.toThrow('Not a zstd file');
  });

  it('rejects a file cut short', async () => {
    const whole = frame('header\nrow1\n'.repeat(1000));
    const path = await write('cut-short.csv.zst', whole.subarray(0, whole.length - 3));
    await expect(zstdFrameRanges(path)).rejects.toThrow(/Truncated/);
  });
});
