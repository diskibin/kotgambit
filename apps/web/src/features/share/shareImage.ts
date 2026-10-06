import { downloadFile } from '../../shared/download';

export interface ShareDetails {
  blob: Blob;
  fileName: string;
  /** The words that go with the picture. */
  text: string;
  /** Where the picture leads: the site itself. */
  url: string;
}

/**
 * Hands the picture to the share sheet of the system when the browser has one that takes files (phones, some
 * desktops), and saves it to the downloads otherwise. Closing the sheet is not an error.
 */
export async function shareImage({ blob, fileName, text, url }: ShareDetails): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      throw error;
    }
    return;
  }
  downloadFile(fileName, blob);
}
