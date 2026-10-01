import { MOODS } from '@kotgambit/mascot';
import { render } from '@testing-library/react-native';
import { Mascot } from './Mascot';

describe('Mascot', () => {
  it('renders every mood with its accessories', () => {
    for (const mood of MOODS) {
      const { unmount } = render(<Mascot mood={mood} accessory="crown" animate />);
      unmount();
    }
  });

  it('is hidden from assistive technology', () => {
    const { toJSON } = render(<Mascot mood="idle" />);
    expect(JSON.stringify(toJSON())).toContain('no-hide-descendants');
  });
});
