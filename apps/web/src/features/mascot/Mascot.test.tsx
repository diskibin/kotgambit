import { render } from '@testing-library/react';
import { Mascot } from './Mascot';

const layer = (container: HTMLElement, name: string) =>
  container.querySelector(`[data-layer="${name}"]`);

describe('Mascot', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Mascot mood="idle" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the layers of the rig', () => {
    const { container } = render(<Mascot mood="idle" />);
    for (const name of ['body', 'head', 'eyes', 'mouth', 'tail', 'whiskers']) {
      expect(layer(container, name)).not.toBeNull();
    }
  });

  it('follows the mood', () => {
    const { container, rerender } = render(<Mascot mood="idle" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-mood', 'idle');
    expect(layer(container, 'fx-bulb')).toBeNull();
    rerender(<Mascot mood="hint" />);
    expect(layer(container, 'fx-bulb')).not.toBeNull();
  });

  it('sizes the drawing', () => {
    const { container } = render(<Mascot mood="idle" size={96} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '96');
  });

  it('puts on an accessory', () => {
    const { container } = render(<Mascot mood="idle" accessory="crown" />);
    expect(layer(container, 'acc-crown')).not.toBeNull();
  });

  it('animates only on request', () => {
    const { container, rerender } = render(<Mascot mood="idle" />);
    expect(container.querySelector('svg')).not.toHaveClass('mascot--animate');
    rerender(<Mascot mood="idle" animate />);
    expect(container.querySelector('svg')).toHaveClass('mascot--animate');
  });
});
