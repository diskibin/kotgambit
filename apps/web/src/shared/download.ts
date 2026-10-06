/** Hands a file to the browser's downloads, the way a link with `download` does. */
export function downloadFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // The click has started the download, the address is not needed any more
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadFile(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}
