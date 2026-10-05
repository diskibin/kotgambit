# Piece sets

The sets a learner can choose in the settings, besides the pieces of the cat in `assets/pieces`.
Every set has the twelve files `wK.svg` ... `bP.svg`, drawn on their own viewBox.

| Folder    | Name in the app | Author                   | License                                    |
| --------- | --------------- | ------------------------ | ------------------------------------------ |
| `classic` | Классика        | chessnut, Alexis Luengas | Apache License 2.0 (`classic/LICENSE.txt`) |
| `warm`    | Тёплые          | rhosgfx, RhosGFX         | CC0 1.0                                    |
| `lines`   | Линии           | totoy, Kosal Sen         | CC BY 4.0                                  |

They come from the Lichess repository (`public/piece`). The only change: the CSS and `style` attributes of a file were
written into the attributes of its elements, so that react-native-svg can draw it, the picture is identical.
Details and credits: `THIRD_PARTY_NOTICES.md`. LICENSE-ASSETS does not apply to this folder.
