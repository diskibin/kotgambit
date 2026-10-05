import { PIECE_SETS } from '@kotgambit/preferences';
import { PIECE_SET_XML } from '../src/features/board/pieceXml';

const KEYS = ['K', 'Q', 'R', 'B', 'N', 'P'].flatMap((type) => [`w${type}`, `b${type}`]);

describe('the sets of pieces of the app', () => {
  it('has a set for every name the settings know, with all twelve pieces', () => {
    for (const set of PIECE_SETS) {
      expect(Object.keys(PIECE_SET_XML[set] ?? {}).sort()).toEqual([...KEYS].sort());
    }
  });

  it('draws every piece with plain elements: no style blocks, classes or filters that react-native-svg skips', () => {
    for (const set of PIECE_SETS) {
      for (const [key, xml] of Object.entries(PIECE_SET_XML[set] ?? {})) {
        expect({ set, key, ok: !/<style|class=|<filter|style=/.test(xml) }).toEqual({
          set,
          key,
          ok: true,
        });
      }
    }
  });
});
