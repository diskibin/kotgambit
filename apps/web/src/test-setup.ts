import '@testing-library/jest-dom/vitest';
import './shared/i18n';

// jsdom has no matchMedia, the theme code asks the browser for the system colour scheme
window.matchMedia ??= (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;
