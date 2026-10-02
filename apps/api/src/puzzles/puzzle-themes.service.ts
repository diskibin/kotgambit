import { PuzzleThemesSchema } from '@kotgambit/content-schema';
import type { PuzzleThemeLabel } from '@kotgambit/contracts';
import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Same depth from src and from dist, so the file is found either way
const THEMES_FILE = fileURLToPath(
  new URL('../../../../content/puzzle-themes.ru.yaml', import.meta.url),
);

/** The Russian names of the puzzle themes. A hidden or unknown theme is never shown to the learner. */
@Injectable()
export class PuzzleThemesService {
  private readonly themes: ReadonlyMap<string, string>;

  constructor() {
    // A broken dictionary stops the start, a puzzle with raw theme keys would be worse
    const file = PuzzleThemesSchema.parse(parse(readFileSync(THEMES_FILE, 'utf8')));
    this.themes = new Map(
      Object.entries(file.themes)
        .filter(([, theme]) => !theme.hidden)
        .map(([key, theme]) => [key, theme.title]),
    );
  }

  label(key: string): PuzzleThemeLabel | null {
    const title = this.themes.get(key);
    return title === undefined ? null : { key, title };
  }

  labels(keys: readonly string[]): PuzzleThemeLabel[] {
    return keys.flatMap((key) => this.label(key) ?? []);
  }
}
