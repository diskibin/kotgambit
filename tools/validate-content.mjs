// Checks every lesson file against the schema and with chess.js, and the puzzle theme dictionary.
// Usage: node tools/validate-content.mjs [dir ...]   (default: content/lessons and CONTENT_PRIVATE_DIR when set)
import {
  BotsFileSchema,
  LessonSchema,
  PuzzleThemesSchema,
  validateBots,
  validateCatalog,
  validateLesson,
  validatePuzzleThemes,
} from '@kotgambit/content-schema';
import { fileURLToPath } from 'node:url';
import { lessonFiles, readYaml } from './content.mjs';

const defaultDir = fileURLToPath(new URL('../content/lessons', import.meta.url));
const themesFile = fileURLToPath(new URL('../content/puzzle-themes.ru.yaml', import.meta.url));
const botsFile = fileURLToPath(new URL('../content/bots.yaml', import.meta.url));
const privateDir = process.env.CONTENT_PRIVATE_DIR;
const dirs =
  process.argv.length > 2
    ? process.argv.slice(2)
    : [defaultDir, ...(privateDir ? [privateDir] : [])];

let problems = 0;
const lessons = [];
const report = (file, path, message) => {
  problems += 1;
  console.error(`${file}: ${path}: ${message}`);
};

for (const file of dirs.flatMap(lessonFiles)) {
  const parsed = LessonSchema.safeParse(readYaml(file));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) report(file, issue.path.join('.'), issue.message);
    continue;
  }
  lessons.push(parsed.data);
  for (const issue of validateLesson(parsed.data)) report(file, issue.path, issue.message);
}
for (const issue of validateCatalog(lessons)) report('catalog', issue.path, issue.message);

// Only the default run checks the dictionary and the bots: a custom directory is a set of lesson files to try out
if (process.argv.length <= 2) {
  const themes = PuzzleThemesSchema.safeParse(readYaml(themesFile));
  if (!themes.success) {
    for (const issue of themes.error.issues)
      report(themesFile, issue.path.join('.'), issue.message);
  } else {
    for (const problem of validatePuzzleThemes(themes.data)) report(themesFile, 'themes', problem);
  }

  const bots = BotsFileSchema.safeParse(readYaml(botsFile));
  if (!bots.success) {
    for (const issue of bots.error.issues) report(botsFile, issue.path.join('.'), issue.message);
  } else {
    for (const problem of validateBots(bots.data)) report(botsFile, 'bots', problem);
  }
}

if (problems > 0) {
  console.error(`\n${problems} problem(s) in the content`);
  process.exit(1);
}
console.log(`Content is valid: ${lessons.length} lesson(s)`);
