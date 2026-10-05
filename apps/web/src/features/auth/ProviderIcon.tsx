import type { OAuthProviderId } from '@kotgambit/contracts';
import google1x from './assets/google-g.png';
import google2x from './assets/google-g@2x.png';
import google3x from './assets/google-g@3x.png';

// Google: the official icon from its brand assets (Sign in with Google, light, square), used as it is. The file is
// 40x40, Google does not allow changing the logo, so it is shown at its own size.
const GOOGLE_SIZE = 40;
const MARK_SIZE = 32;

// Yandex and VK: the marks the design draws (web/source/Profile.dc.html). They are brand colors, not part of
// our palette, and they stand in until the official files of the two services are added (see THIRD_PARTY_NOTICES.md)
const MARKS = {
  yandex: {
    text: 'Я',
    className: 'rounded-full text-[16px]',
    style: { background: '#FC3F1D', color: '#FFFFFF' },
  },
  vk: {
    text: 'VK',
    className: 'rounded-[9px] text-[12px]',
    style: { background: '#0077FF', color: '#FFFFFF' },
  },
} as const;

/** The mark of a service next to its name. It says nothing a screen reader needs: the button has a label. */
export function ProviderIcon({ id }: { id: OAuthProviderId }) {
  if (id === 'google') {
    return (
      <img
        src={google1x}
        srcSet={`${google2x} 2x, ${google3x} 3x`}
        width={GOOGLE_SIZE}
        height={GOOGLE_SIZE}
        alt=""
        aria-hidden="true"
        className="shrink-0"
      />
    );
  }
  const mark = MARKS[id];
  return (
    <span
      aria-hidden="true"
      style={{ ...mark.style, width: MARK_SIZE, height: MARK_SIZE }}
      className={`flex shrink-0 items-center justify-center font-extrabold ${mark.className}`}
    >
      {mark.text}
    </span>
  );
}
