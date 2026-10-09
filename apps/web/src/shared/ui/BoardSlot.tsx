import type { ReactNode } from 'react';

/**
 * On a phone the board is as wide as the screen or as 44% of its height, whichever is less (the small viewport, so that the bars of the browser coming and going do not resize it), so that
 * the text under it has room and the board keeps one size from step to step. From a tablet up it is
 * the board as it was.
 */
export function BoardSlot({ children }: { children: ReactNode }) {
  return <div className="max-tablet:mx-auto max-tablet:w-[min(100%,44svh)]">{children}</div>;
}
