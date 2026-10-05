import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProviderIcon } from './ProviderIcon';

describe('ProviderIcon', () => {
  it('shows the official icon of Google at its own size, for three densities', () => {
    const { container } = render(<ProviderIcon id="google" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('width', '40');
    expect(img).toHaveAttribute('height', '40');
    expect(img?.getAttribute('srcset')).toMatch(/ 2x, .* 3x$/);
  });

  it('shows the marks of Yandex and VK from the design', () => {
    const yandex = render(<ProviderIcon id="yandex" />);
    expect(yandex.container.textContent).toBe('Я');
    const vk = render(<ProviderIcon id="vk" />);
    expect(vk.container.textContent).toBe('VK');
  });

  it('is decoration only: the button around it has the label', () => {
    for (const id of ['yandex', 'vk', 'google'] as const) {
      const { container } = render(<ProviderIcon id={id} />);
      expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
