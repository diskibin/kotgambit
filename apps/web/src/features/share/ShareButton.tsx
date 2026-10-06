import type { Mood } from '@kotgambit/mascot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../shared/ui/Button';
import { useWornAccessory } from '../mascot/useWornAccessory';
import { useScheme } from '../theme/useScheme';
import type { ShareCardSpec } from './drawCard';
import { createShareImage } from './createShareImage';
import { shareImage } from './shareImage';

interface ShareButtonProps {
  /** What the card says, without the name of the site: that is added here. */
  card: Omit<ShareCardSpec, 'site'>;
  mood: Mood;
  /** The screen reader says what is being shared, not just "share". */
  label: string;
  /** A small button inside a list, instead of a full one. */
  compact?: boolean;
}

/** Draws a card on the device and shares it as a picture, or saves it. Nothing leaves the device by itself. */
export function ShareButton({ card, mood, label, compact = false }: ShareButtonProps) {
  const { t } = useTranslation();
  const dark = useScheme() === 'dark';
  const accessory = useWornAccessory();
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');

  async function share() {
    setState('working');
    try {
      const blob = await createShareImage({
        spec: { ...card, site: window.location.host },
        mood,
        accessory,
        dark,
      });
      await shareImage({
        blob,
        fileName: t('share.fileName'),
        text: t('share.text'),
        url: window.location.origin,
      });
      setState('idle');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${compact ? 'items-start' : 'w-full'}`}>
      <Button
        variant="secondary"
        fullWidth={!compact}
        disabled={state === 'working'}
        aria-label={label}
        onClick={() => void share()}
      >
        {t('share.button')}
      </Button>
      {state === 'failed' && (
        <span role="alert" className="text-[13px] font-semibold text-coral-text">
          {t('share.failed')}
        </span>
      )}
    </div>
  );
}
