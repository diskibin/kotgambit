import type { EngineProcess } from './engine-process.js';

type Reply = (command: string, say: (line: string) => void) => void;

/** A scripted stand-in for a UCI engine, shared by the engine and pool tests. */
export class FakeEngineProcess implements EngineProcess {
  readonly sent: string[] = [];
  killed = false;
  private lineListener: ((line: string) => void) | undefined;
  private exitListener: (() => void) | undefined;

  constructor(private readonly reply: Reply) {}

  write(line: string): void {
    this.sent.push(line);
    this.reply(line, (answer) => this.lineListener?.(answer));
  }

  onLine(listener: (line: string) => void): void {
    this.lineListener = listener;
  }

  onExit(listener: () => void): void {
    this.exitListener = listener;
  }

  kill(): void {
    this.killed = true;
  }

  emit(line: string): void {
    this.lineListener?.(line);
  }

  crash(): void {
    this.exitListener?.();
  }
}

/** Answers the handshake the way a real engine does and leaves the search to `onGo`. */
export function scriptedEngine(onGo: Reply = () => undefined): FakeEngineProcess {
  return new FakeEngineProcess((command, say) => {
    if (command === 'uci') {
      say('id name Fake 1');
      say('uciok');
    } else if (command === 'isready') {
      say('readyok');
    } else if (command.startsWith('go ')) {
      onGo(command, say);
    }
  });
}

export const FINISHED_SEARCH: Reply = (_command, say) => {
  say('info depth 1 seldepth 1 multipv 1 score cp 20 nodes 20 time 1 pv e2e4');
  say('info depth 2 seldepth 2 multipv 1 score cp 25 nodes 90 time 2 pv e2e4 e7e5');
  say('bestmove e2e4 ponder e7e5');
};
