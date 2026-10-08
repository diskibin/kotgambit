import { TRACKS } from '@kotgambit/content-schema';
import { describe, expect, it } from 'vitest';
import { otherSections } from './otherSections';

describe('the sections under the ribbon', () => {
  it('shows one behind and two ahead in the middle of the path', () => {
    expect(otherSections(TRACKS, 'tactics')).toEqual(['openings', 'middlegame', 'strategy']);
  });

  it('shows three ahead when nothing is behind', () => {
    expect(otherSections(TRACKS, 'basics')).toEqual(['practice', 'openings', 'tactics']);
  });

  it('shows three behind when nothing is ahead', () => {
    expect(otherSections(TRACKS, 'games')).toEqual(['strategy', 'mates', 'endgame']);
  });

  it('shows two behind and one ahead when only one section is ahead', () => {
    expect(otherSections(TRACKS, 'endgame')).toEqual(['strategy', 'mates', 'games']);
  });

  it('shows one behind and one ahead when there are only three sections', () => {
    expect(otherSections(['basics', 'openings', 'endgame'], 'openings')).toEqual([
      'basics',
      'endgame',
      'practice',
    ]);
  });

  it('fills the row with the sections that are only announced', () => {
    expect(otherSections(['basics', 'openings'], 'basics')).toEqual([
      'openings',
      'practice',
      'tactics',
    ]);
  });
});
