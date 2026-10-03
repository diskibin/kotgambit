import { Component, type ReactNode } from 'react';
import i18n from '../../shared/i18n';
import { Mascot } from '../mascot/Mascot';

interface State {
  failed: boolean;
}

/**
 * Catches a screen that broke while drawing and says it in the voice of the cat. It sits above the router's
 * pages, so it cannot lean on the theme store: the cat is drawn in the light outline of the page itself.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const t = i18n.t.bind(i18n);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 py-10 text-center text-text">
        <Mascot mood="thinking" size={220} />
        <span className="inline-flex min-h-8 items-center rounded-pill bg-sky-tint px-3.5 text-[14px] font-bold text-sky-text">
          {t('system.busy.chip')}
        </span>
        <h1 className="m-0 font-heading text-[28px] leading-9 font-bold tablet:text-[40px] tablet:leading-[48px]">
          {t('system.busy.title')}
        </h1>
        <p className="m-0 max-w-[600px] text-[19px] leading-7 font-semibold text-text-2">
          {t('system.busy.text')}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex h-14 items-center justify-center rounded-card border-2 border-edge bg-brand px-4 text-[18px] font-extrabold text-on-brand shadow-shashka"
        >
          {t('system.busy.retry')}
        </button>
      </main>
    );
  }
}
