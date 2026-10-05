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

- **Google "G"** (`apps/web/src/features/auth/assets` and `apps/mobile/src/features/auth/assets`) is cut from a file of the official
  Sign in with Google brand assets (https://developers.google.com/identity/branding-guidelines, light theme, square, no text): the
  central 20x20 area of the 40x40 icon (and the same area of the @2x and @3x files), so the frame of the button is left out and the
  G itself is not changed, in size or color. It is shown on a white plate, as the guidelines ask. It is a trademark of Google LLC and
  is not covered by the license of this repository.
- The marks of **Yandex** and **VK** on the sign-in buttons are simple stand-ins drawn by the project, not the official logos.
  The official files of the two services replace them (`ProviderIcon.tsx` in the web and the mobile app).

## Chess piece sets

The sets of pieces the learner can choose in the settings (`assets/piece-sets`). The files were taken from the
Lichess repository (https://github.com/lichess-org/lila, `public/piece`, listed in its COPYING.md) and changed in one
way only: the CSS of a file was written into the attributes of its elements, so that react-native-svg can draw it. The
picture is the same pixel for pixel. The names in the app are in brackets.

- **chessnut** by Alexis Luengas (https://github.com/LexLuengas/chessnut-pieces), Apache License 2.0, text in
  `assets/piece-sets/classic/LICENSE.txt` («Классика»). The files were changed as said above.
- **rhosgfx** by RhosGFX (https://rhosgfx.itch.io/), CC0 1.0, no conditions («Тёплые»).
- **totoy** by Kosal Sen, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), credit given here («Линии»).
  The files were changed as said above.
- The set «Гамбит» is our own and is covered by LICENSE-ASSETS.
