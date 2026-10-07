import { vi } from 'vitest';

// vi.waitFor gives up after one second unless told otherwise, and Vitest has no setting for that default.
// The mail goes out after the answer to a request, which on a loaded CI runner can take longer than that
const DEFAULT_WAIT_FOR_MS = 10_000;
const waitFor = vi.waitFor.bind(vi);
vi.waitFor = ((callback, options) =>
  waitFor(callback, {
    timeout: DEFAULT_WAIT_FOR_MS,
    ...(typeof options === 'number' ? { timeout: options } : options),
  })) as typeof vi.waitFor;
