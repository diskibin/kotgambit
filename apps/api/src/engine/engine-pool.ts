import type { Analysis, AnalyzeRequest } from './uci-engine.js';

/** Lower number is served first. A bot move has a person waiting for it, a game review does not. */
export const Priority = { Bot: 0, Analysis: 1, Review: 2 } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

/** What the pool needs from an engine, so that tests can use plain stubs. */
export interface SearchEngine {
  analyze(request: AnalyzeRequest, timeoutMs: number): Promise<Analysis>;
  close(): void;
}

export class EngineBusyError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('The engine queue is full');
  }
}

export interface PoolOptions {
  /** How many requests may wait. When it is full new ones are turned away instead of piling up. */
  maxQueue: number;
  defaultTimeoutMs: number;
  /** What a turned away client is told to wait, it comes back in the `Retry-After` header. */
  retryAfterSeconds: number;
}

export interface PoolMetrics {
  workers: number;
  busy: number;
  queued: number;
  completed: number;
  rejected: number;
  failed: number;
  /** Average wait in the queue over the most recent requests, in milliseconds. */
  recentWaitMs: number;
}

export interface SearchOptions {
  priority: Priority;
  timeoutMs?: number;
}

interface Job {
  request: AnalyzeRequest;
  priority: Priority;
  timeoutMs: number;
  enqueuedAt: number;
  resolve: (analysis: Analysis) => void;
  reject: (error: unknown) => void;
}

const WAIT_SAMPLES = 100;

export class EnginePool {
  private readonly idle: SearchEngine[];
  private readonly queue: Job[] = [];
  private readonly waits: number[] = [];
  private completed = 0;
  private rejected = 0;
  private failed = 0;
  private closed = false;

  constructor(
    private readonly engines: readonly SearchEngine[],
    private readonly options: PoolOptions,
    private readonly now: () => number = Date.now,
  ) {
    this.idle = [...engines];
  }

  analyze(request: AnalyzeRequest, search: SearchOptions): Promise<Analysis> {
    if (this.closed) return Promise.reject(new Error('The engine pool is closed'));
    return new Promise((resolve, reject) => {
      const job: Job = {
        request,
        priority: search.priority,
        timeoutMs: search.timeoutMs ?? this.options.defaultTimeoutMs,
        enqueuedAt: this.now(),
        resolve,
        reject,
      };
      if (!this.admit(job)) {
        this.rejected += 1;
        reject(new EngineBusyError(this.options.retryAfterSeconds));
        return;
      }
      this.dispatch();
    });
  }

  metrics(): PoolMetrics {
    const waited = this.waits.reduce((sum, wait) => sum + wait, 0);
    return {
      workers: this.engines.length,
      busy: this.engines.length - this.idle.length,
      queued: this.queue.length,
      completed: this.completed,
      rejected: this.rejected,
      failed: this.failed,
      recentWaitMs: this.waits.length === 0 ? 0 : Math.round(waited / this.waits.length),
    };
  }

  close(): void {
    this.closed = true;
    for (const job of this.queue.splice(0)) job.reject(new Error('The engine pool is closed'));
    this.engines.forEach((engine) => engine.close());
  }

  /**
   * Puts the job in line, after the jobs of the same or higher priority. When the line is full a more
   * important job pushes out the newest least important one: a bot move must not be turned away
   * just because background reviews filled the queue.
   */
  private admit(job: Job): boolean {
    if (this.queue.length >= this.options.maxQueue) {
      const last = this.queue[this.queue.length - 1];
      if (!last || last.priority <= job.priority) return false;
      this.queue.pop();
      this.rejected += 1;
      last.reject(new EngineBusyError(this.options.retryAfterSeconds));
    }
    const index = this.queue.findIndex((queued) => queued.priority > job.priority);
    this.queue.splice(index === -1 ? this.queue.length : index, 0, job);
    return true;
  }

  private dispatch(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const engine = this.idle.pop();
      const job = this.queue.shift();
      if (!engine || !job) return;
      this.recordWait(this.now() - job.enqueuedAt);
      void this.run(engine, job);
    }
  }

  private async run(engine: SearchEngine, job: Job): Promise<void> {
    try {
      job.resolve(await engine.analyze(job.request, job.timeoutMs));
      this.completed += 1;
    } catch (error) {
      this.failed += 1;
      job.reject(error);
    } finally {
      this.idle.push(engine);
      this.dispatch();
    }
  }

  private recordWait(waitMs: number): void {
    this.waits.push(waitMs);
    if (this.waits.length > WAIT_SAMPLES) this.waits.shift();
  }
}
