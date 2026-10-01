// Shared by validate-content and the seed script: finds and reads lesson files.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export function lessonFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return lessonFiles(path);
    return /\.ya?ml$/.test(name) ? [path] : [];
  });
}

export function readYaml(path) {
  return parse(readFileSync(path, 'utf8'));
}
