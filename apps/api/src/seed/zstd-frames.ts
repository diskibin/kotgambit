import { createReadStream } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import { StringDecoder } from 'node:string_decoder';
import { createZstdDecompress } from 'node:zlib';

// RFC 8878, section 3.1: a zstd file is a sequence of frames, some of them skippable
const FRAME_MAGIC = 0xfd2fb528;
const SKIPPABLE_MAGIC = 0x184d2a50;
const SKIPPABLE_MASK = 0xfffffff0;
const SKIPPABLE_HEADER_BYTES = 8;
const BLOCK_HEADER_BYTES = 3;
const BLOCK_TYPE_RLE = 1;
const BLOCK_TYPE_RESERVED = 3;
const CHECKSUM_BYTES = 4;
const DICTIONARY_ID_BYTES = [0, 1, 2, 4];
const CONTENT_SIZE_BYTES = [0, 2, 4, 8];

export interface ByteRange {
  start: number;
  /** Exclusive. */
  end: number;
}

async function readAt(file: FileHandle, position: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await file.read(buffer, 0, length, position);
  if (bytesRead < length) throw new Error(`Truncated zstd file at byte ${position}`);
  return buffer;
}

/** Finds where a frame ends by walking its block headers, without decompressing anything. */
async function frameEnd(file: FileHandle, start: number): Promise<number> {
  let position = start + 4;
  const descriptor = (await readAt(file, position, 1)).readUInt8(0);
  position += 1;
  const contentSizeFlag = descriptor >> 6;
  const singleSegment = (descriptor >> 5) & 1;
  const hasChecksum = (descriptor >> 2) & 1;
  const dictionaryFlag = descriptor & 3;

  if (!singleSegment) position += 1; // the window descriptor
  position += DICTIONARY_ID_BYTES[dictionaryFlag] ?? 0;
  // With a single segment and no size flag the content size still takes one byte
  position += contentSizeFlag === 0 ? singleSegment : (CONTENT_SIZE_BYTES[contentSizeFlag] ?? 0);

  for (;;) {
    const header = await readAt(file, position, BLOCK_HEADER_BYTES);
    const value = header.readUIntLE(0, BLOCK_HEADER_BYTES);
    const isLast = (value & 1) === 1;
    const type = (value >> 1) & 3;
    const size = value >>> 3;
    if (type === BLOCK_TYPE_RESERVED) throw new Error(`Invalid zstd block at byte ${position}`);
    // An RLE block stores one byte however long it is when expanded
    position += BLOCK_HEADER_BYTES + (type === BLOCK_TYPE_RLE ? 1 : size);
    if (isLast) break;
  }
  return position + (hasChecksum ? CHECKSUM_BYTES : 0);
}

/**
 * The byte ranges of the real frames of a file, leaving out the skippable ones. Node's own zstd stream stops
 * with "Unknown frame descriptor" at a skippable frame, and the Lichess puzzle file has them, at the start
 * and between frames.
 */
export async function zstdFrameRanges(path: string): Promise<ByteRange[]> {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    const ranges: ByteRange[] = [];
    let offset = 0;
    while (offset < size) {
      const magic = (await readAt(file, offset, 4)).readUInt32LE(0);
      if ((magic & SKIPPABLE_MASK) >>> 0 === SKIPPABLE_MAGIC) {
        const length = (await readAt(file, offset + 4, 4)).readUInt32LE(0);
        offset += SKIPPABLE_HEADER_BYTES + length;
      } else if (magic === FRAME_MAGIC) {
        const end = await frameEnd(file, offset);
        ranges.push({ start: offset, end });
        offset = end;
      } else {
        throw new Error(`Not a zstd file: unexpected data at byte ${offset}`);
      }
    }
    if (offset !== size) throw new Error(`Truncated zstd file, ends at byte ${offset} of ${size}`);
    return ranges;
  } finally {
    await file.close();
  }
}

async function* decompressedChunks(path: string): AsyncGenerator<Buffer> {
  for (const { start, end } of await zstdFrameRanges(path)) {
    const frame = createReadStream(path, { start, end: end - 1 }).pipe(createZstdDecompress());
    for await (const chunk of frame) yield chunk as Buffer;
  }
}

/**
 * The lines of a text file, plain or zstd-compressed (by the `.zst` ending). A line may straddle two
 * frames or two chunks, so the text is cut into lines only after the chunks are joined.
 */
export async function* readLines(path: string): AsyncGenerator<string> {
  const chunks: AsyncIterable<Buffer | string> = path.endsWith('.zst')
    ? decompressedChunks(path)
    : createReadStream(path);
  const decoder = new StringDecoder('utf8');
  let carry = '';
  for await (const chunk of chunks) {
    carry += typeof chunk === 'string' ? chunk : decoder.write(chunk);
    const lines = carry.split('\n');
    carry = lines.pop() ?? '';
    for (const line of lines) yield line.endsWith('\r') ? line.slice(0, -1) : line;
  }
  carry += decoder.end();
  if (carry) yield carry;
}
