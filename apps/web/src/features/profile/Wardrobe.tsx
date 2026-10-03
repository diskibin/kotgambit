import type { AccessoryKey, Wardrobe as WardrobeData } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { useSetAccessoryMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';

/** What the cat can wear: the rewards the learner has earned, and the ones still ahead. */
export function Wardrobe({ wardrobe }: { wardrobe: WardrobeData }) {
  const { t } = useTranslation();
  const dark = useScheme() === 'dark';
  const [setAccessory, result] = useSetAccessoryMutation();
  const open = wardrobe.items.filter((item) => item.unlocked).length;

  return (
    <section className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-heading text-[18px] font-bold">{t('wardrobe.title')}</h2>
        <span className="text-[14px] font-bold text-text-2">
          {t('wardrobe.count', { open, total: wardrobe.items.length })}
        </span>
      </div>
      <div role="radiogroup" aria-label={t('wardrobe.title')} className="grid grid-cols-3 gap-2">
        {wardrobe.items.map((item) => {
          const worn = item.key === wardrobe.selected;
          const name = t(`wardrobe.items.${item.key}.name`);
          const hint = t(`wardrobe.items.${item.key}.hint`);
          return (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={worn}
              aria-label={`${name}. ${worn ? t('wardrobe.worn') : item.unlocked ? hint : `${hint}, ${t('wardrobe.locked')}`}`}
              disabled={!item.unlocked}
              onClick={() => void setAccessory({ accessory: item.key as AccessoryKey })}
              className={`flex min-h-[132px] flex-col items-center justify-center gap-1 rounded-card border-2 p-2 text-center ${
                worn
                  ? 'border-brand bg-brand-tint'
                  : item.unlocked
                    ? 'border-line bg-surface'
                    : 'border-dashed border-dashed bg-surface opacity-60'
              }`}
            >
              <Mascot mood="idle" size={64} accessory={item.key} dark={dark} />
              <span className="text-[14px] font-extrabold">{name}</span>
              <span className="text-[12px] leading-4 font-semibold text-text-2">
                {worn ? t('wardrobe.worn') : hint}
              </span>
            </button>
          );
        })}
      </div>
      {result.isError && <Banner>{t('wardrobe.error')}</Banner>}
    </section>
  );
}
