import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadFile } from '../../shared/download';
import { shareImage } from './shareImage';

vi.mock('../../shared/download', () => ({ downloadFile: vi.fn() }));

const DETAILS = {
  blob: new Blob(['png'], { type: 'image/png' }),
  fileName: 'kot-gambit.png',
  text: 'Учусь шахматам с котом Гамбитом',
  url: 'https://kotgambit.example',
};

function browserWith(share: { canShare?: () => boolean; share?: () => Promise<void> }) {
  Object.defineProperty(navigator, 'canShare', { value: share.canShare, configurable: true });
  Object.defineProperty(navigator, 'share', { value: share.share, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
  vi.mocked(downloadFile).mockClear();
});

describe('sharing the picture', () => {
  it('gives the file, the words and the address to the share sheet when it takes files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    browserWith({ canShare: () => true, share });
    await shareImage(DETAILS);
    expect(share).toHaveBeenCalledTimes(1);
    const sent = share.mock.calls[0]?.[0] as { files: File[]; text: string; url: string };
    expect(sent.files[0]).toMatchObject({ name: 'kot-gambit.png', type: 'image/png' });
    expect(sent).toMatchObject({ text: DETAILS.text, url: DETAILS.url });
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('saves the file when the browser cannot share files, or has no share sheet at all', async () => {
    browserWith({ canShare: () => false, share: vi.fn() });
    await shareImage(DETAILS);
    browserWith({});
    await shareImage(DETAILS);
    expect(downloadFile).toHaveBeenCalledTimes(2);
    expect(downloadFile).toHaveBeenCalledWith('kot-gambit.png', DETAILS.blob);
  });

  it('is not an error when the learner closes the share sheet', async () => {
    browserWith({
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')),
    });
    await expect(shareImage(DETAILS)).resolves.toBeUndefined();
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('is an error when the share sheet fails for another reason', async () => {
    browserWith({
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')),
    });
    await expect(shareImage(DETAILS)).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});
