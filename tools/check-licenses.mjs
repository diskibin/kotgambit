// Fails when a production dependency has a license that is not on the list, see PLAN.md 8 and 15.6.
// Usage: node tools/check-licenses.mjs
import { spawnSync } from 'node:child_process';

// Permissive licenses, plus MPL-2.0 (the copyleft stays in the files of that library) and OFL-1.1 (the fonts)
const ALLOWED = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'MPL-2.0',
  'OFL-1.1',
  'Unlicense',
  'Python-2.0',
]);

// A package that is not shipped to the learner and has a license of its own, with the reason
const EXCEPTIONS = new Map();

// Under `pnpm run` the path of pnpm is known (a script of node, or the binary itself) and no shell is needed;
// elsewhere a shell finds pnpm (pnpm.cmd on Windows)
const pnpm = process.env.npm_execpath;
const args = ['-r', 'licenses', 'list', '--prod', '--json'];
const options = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
let run;
if (!pnpm) run = spawnSync('pnpm', args, { ...options, shell: true });
else if (/\.[cm]?js$/.test(pnpm)) run = spawnSync(process.execPath, [pnpm, ...args], options);
else run = spawnSync(pnpm, args, options);
if (run.status !== 0) {
  console.error(run.stderr || 'pnpm licenses failed');
  process.exit(1);
}

/** `(MIT OR Apache-2.0)` is fine when one of the alternatives is, `AND` needs all of them. */
function accepted(expression) {
  const text = expression.replace(/[()]/g, ' ');
  if (/\sAND\s/.test(text)) return text.split(/\sAND\s/).every((part) => accepted(part));
  return text.split(/\sOR\s/).some((part) => ALLOWED.has(part.trim()));
}

const byLicense = JSON.parse(run.stdout);
const problems = [];
let total = 0;
for (const [license, packages] of Object.entries(byLicense)) {
  total += packages.length;
  if (accepted(license)) continue;
  for (const { name } of packages) {
    if (!EXCEPTIONS.has(name)) problems.push(`${name}: ${license}`);
  }
}

if (problems.length > 0) {
  console.error(`Licenses that are not on the list:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`licenses: ${total} production dependencies, all on the list`);
