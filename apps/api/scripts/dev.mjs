// Runs the API for development: tsc rebuilds on every change and node restarts on the new files.
// `tsx` cannot do this job, it does not emit the decorator metadata that NestJS needs to inject dependencies.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');

const compiler = spawn(
  process.execPath,
  [tsc, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);

let server = null;

compiler.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  // The first "Watching for file changes" means the first build is done, so dist/main.js exists
  if (server === null && text.includes('Watching for file changes')) {
    server = spawn(
      process.execPath,
      ['--watch', '--env-file-if-exists=../../.env', 'dist/main.js'],
      { stdio: 'inherit' },
    );
    server.on('exit', () => compiler.kill());
  }
});

const stop = () => {
  compiler.kill();
  server?.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
compiler.on('exit', (code) => {
  server?.kill();
  process.exit(code ?? 0);
});
