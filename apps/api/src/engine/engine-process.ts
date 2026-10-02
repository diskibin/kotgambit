import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

/** The part of an engine process that `UciEngine` needs, so that tests can replace the real binary. */
export interface EngineProcess {
  write(line: string): void;
  onLine(listener: (line: string) => void): void;
  /** Fires once when the process is gone for any reason, including a binary that cannot be started. */
  onExit(listener: () => void): void;
  kill(): void;
}

export type SpawnEngine = () => EngineProcess;

export function spawnEngineProcess(path: string): EngineProcess {
  const child = spawn(path, [], { stdio: ['pipe', 'pipe', 'ignore'] });
  const exitListeners: (() => void)[] = [];
  let exited = false;
  const notifyExit = () => {
    if (exited) return;
    exited = true;
    exitListeners.forEach((listener) => listener());
  };
  // `error` is how a missing or non-executable binary shows up, `exit` may never follow it
  child.once('error', notifyExit);
  child.once('exit', notifyExit);
  // A write to a dead process fails with EPIPE, `exit` already reports the real problem
  child.stdin.on('error', () => undefined);

  return {
    write: (line) => {
      child.stdin.write(`${line}\n`);
    },
    onLine: (listener) => {
      createInterface({ input: child.stdout }).on('line', listener);
    },
    onExit: (listener) => {
      if (exited) listener();
      else exitListeners.push(listener);
    },
    kill: () => {
      child.kill();
    },
  };
}
