import type { EngineProcess, SpawnEngine } from './engine-process.js';
import { parseBestMove, parseInfo, type InfoLine } from './uci-parser.js';

export class EngineTimeoutError extends Error {}
export class EngineCrashedError extends Error {}

export interface AnalyzeRequest {
  fen: string;
  /** At least one of `depth` and `movetimeMs` is required, with both the search ends at whichever comes first. */
  depth?: number;
  movetimeMs?: number;
  multipv?: number;
}

export interface Analysis {
  bestMove: string | null;
  /** One line per variation, best first, all from the last depth the engine finished. */
  lines: InfoLine[];
  /** The time budget ran out and the search was stopped early, so `lines` may be shallower than asked. */
  timedOut: boolean;
}

export interface UciEngineOptions {
  /** UCI options set once after start, such as `Threads` and `Hash`. */
  uciOptions: Record<string, string | number>;
  startupTimeoutMs: number;
}

// An engine answers `stop` within a few milliseconds, so a second without `bestmove` means it is stuck
const STOP_GRACE_MS = 1000;

/**
 * One engine process. It starts on the first request and starts again after a crash or a stuck search,
 * so the pool never has to rebuild it. Runs one search at a time.
 */
export class UciEngine {
  private proc: EngineProcess | null = null;
  private busy = false;
  private closed = false;
  private readonly lineListeners = new Set<(line: string) => void>();
  private readonly exitListeners = new Set<() => void>();

  constructor(
    private readonly spawnProcess: SpawnEngine,
    private readonly options: UciEngineOptions,
  ) {}

  async analyze(request: AnalyzeRequest, timeoutMs: number): Promise<Analysis> {
    if (this.closed) throw new Error('The engine is closed');
    if (this.busy) throw new Error('The engine is already searching');
    this.busy = true;
    try {
      const proc = await this.ensureStarted();
      return await this.search(proc, request, timeoutMs);
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    this.closed = true;
    this.dropProcess();
  }

  private async ensureStarted(): Promise<EngineProcess> {
    if (this.proc) return this.proc;
    const proc = this.spawnProcess();
    this.proc = proc;
    proc.onLine((line) => this.lineListeners.forEach((listener) => listener(line)));
    proc.onExit(() => {
      // A late exit of a process we already dropped must not take down its replacement
      if (this.proc === proc) this.proc = null;
      this.exitListeners.forEach((listener) => listener());
    });

    try {
      const { startupTimeoutMs, uciOptions } = this.options;
      // Listening starts before the command goes out, an answer must never find nobody waiting
      const handshake = this.until((line) => line === 'uciok', startupTimeoutMs);
      proc.write('uci');
      await handshake;
      for (const [name, value] of Object.entries(uciOptions)) {
        proc.write(`setoption name ${name} value ${value}`);
      }
      const ready = this.until((line) => line === 'readyok', startupTimeoutMs);
      proc.write('isready');
      await ready;
    } catch (error) {
      this.dropProcess();
      throw error;
    }
    return proc;
  }

  private async search(
    proc: EngineProcess,
    request: AnalyzeRequest,
    timeoutMs: number,
  ): Promise<Analysis> {
    const limits = [
      request.depth === undefined ? '' : `depth ${request.depth}`,
      request.movetimeMs === undefined ? '' : `movetime ${request.movetimeMs}`,
    ].filter(Boolean);
    if (limits.length === 0) throw new Error('A search needs a depth or a movetime');

    const lines = new Map<number, InfoLine>();
    let bestMove: string | null = null;
    let timedOut = false;

    const finished = this.until(
      (line) => {
        const info = parseInfo(line);
        if (info) {
          const known = lines.get(info.multipv);
          if (!known || info.depth >= known.depth) lines.set(info.multipv, info);
          return false;
        }
        const best = parseBestMove(line);
        if (!best) return false;
        bestMove = best.move;
        return true;
      },
      timeoutMs,
      () => {
        timedOut = true;
        proc.write('stop');
      },
    );
    proc.write(`setoption name MultiPV value ${request.multipv ?? 1}`);
    proc.write(`position fen ${request.fen}`);
    proc.write(`go ${limits.join(' ')}`);

    try {
      await finished;
    } catch (error) {
      // A stuck or dead engine cannot be told apart from a healthy one, so the next request gets a fresh one
      this.dropProcess();
      throw error;
    }
    return {
      bestMove,
      lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
      timedOut,
    };
  }

  /**
   * Resolves when `handle` returns true for a line. With `onSoftTimeout` the first timeout only calls it
   * (to send `stop`) and waits a short grace period for the engine to wrap up.
   */
  private until(
    handle: (line: string) => boolean,
    timeoutMs: number,
    onSoftTimeout?: () => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;
      let stopped = false;

      const cleanup = () => {
        clearTimeout(timer);
        this.lineListeners.delete(onLine);
        this.exitListeners.delete(onExit);
      };
      const onLine = (line: string) => {
        if (!handle(line)) return;
        cleanup();
        resolve();
      };
      const onExit = () => {
        cleanup();
        reject(new EngineCrashedError('The engine process exited'));
      };
      const arm = (ms: number) => {
        timer = setTimeout(() => {
          if (onSoftTimeout && !stopped) {
            stopped = true;
            onSoftTimeout();
            arm(STOP_GRACE_MS);
            return;
          }
          cleanup();
          reject(new EngineTimeoutError('The engine did not answer in time'));
        }, ms);
      };

      this.lineListeners.add(onLine);
      this.exitListeners.add(onExit);
      arm(timeoutMs);
    });
  }

  private dropProcess(): void {
    const proc = this.proc;
    this.proc = null;
    proc?.kill();
  }
}
