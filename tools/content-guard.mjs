// Fails when the public repository holds premium content, see PLAN.md 15.3.
// Usage: node tools/content-guard.mjs [dir]   (default: content)
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lessonFiles, readYaml } from './content.mjs';

const root = process.argv[2] ?? fileURLToPath(new URL('../content', import.meta.url));
const problems = [];

function directories(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? [path, ...directories(path)] : [];
  });
}

for (const dir of directories(root)) {
  if (/(^|[\/])(premium|private)$/i.test(dir))
    problems.push(`${dir}: premium directory in the public repository`);
}
for (const file of lessonFiles(root)) {
  const access = readYaml(file)?.access;
  if (access !== undefined && access !== 'free')
    problems.push(`${file}: access is "${access}", only "free" is allowed here`);
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('content-guard: only free content found');
