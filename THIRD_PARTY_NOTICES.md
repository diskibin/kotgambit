# Third-party notices

Licenses and attribution for third-party data and libraries are listed here
as they are added to the project.

## Fonts

- **Onest** (Copyright 2021 The Onest Project Authors) and **Unbounded**
  (Copyright 2022 The Unbounded Project Authors), licensed under the SIL Open Font License 1.1.
  Static instances of the Google Fonts variable fonts are embedded in the Android app
  (`apps/mobile/android/app/src/main/assets/fonts`), the license texts are next to them.
  The web app uses the same families through `@fontsource` packages.

## Chess engine

- **Stockfish** (Copyright The Stockfish developers), licensed under the GNU General Public License v3.0.
  The API starts it as a separate process through `ENGINE_PATH`, the binary is not part of this repository.
  CI downloads the official release (`.github/workflows/ci.yml`). A deployment image that ships the binary
  must include its license text and point to the source code at https://github.com/official-stockfish/Stockfish.

## Chess puzzles

- **Lichess puzzle database** (https://database.lichess.org/#puzzles), released by Lichess under CC0 1.0.
  A selection of it is loaded into the database by `pnpm --filter @kotgambit/api import:puzzles`,
  the data is not stored in this repository except for a few rows used as test fixtures.

## Brand marks of the sign-in services

- **Google "G" icon** (`apps/web/src/features/auth/assets` and `apps/mobile/src/features/auth/assets`) is a file from the official
  Sign in with Google brand assets (https://developers.google.com/identity/branding-guidelines, light theme, square, no text).
  It is a trademark of Google LLC, it is used unchanged as the guidelines ask and is not covered by the license of this repository.
- The marks of **Yandex** and **VK** on the sign-in buttons are simple stand-ins drawn by the project, not the official logos.
  The official files of the two services replace them (`ProviderIcon.tsx` in the web and the mobile app).
