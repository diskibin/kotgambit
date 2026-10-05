import type { OAuthProviderId } from '@kotgambit/contracts';
import google1x from './assets/google-g.png';
import google2x from './assets/google-g@2x.png';
import google3x from './assets/google-g@3x.png';

// Google: the "G" of its official brand assets (Sign in with Google), cut out of the 40x40 icon without its frame and
// used unchanged, at its own 20x20. Google wants the G on white, so it sits on a white plate of the size of the other marks.
const GOOGLE_G_SIZE = 20;
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
      <span
        aria-hidden="true"
        style={{ background: '#FFFFFF', width: MARK_SIZE, height: MARK_SIZE }}
        className="flex shrink-0 items-center justify-center rounded-[9px]"
      >
        <img
          src={google1x}
          srcSet={`${google2x} 2x, ${google3x} 3x`}
          width={GOOGLE_G_SIZE}
          height={GOOGLE_G_SIZE}
          alt=""
        />
      </span>
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
