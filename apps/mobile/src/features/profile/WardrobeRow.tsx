import type { AccessoryKey, Wardrobe } from '@kotgambit/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useSetAccessoryMutation } from '../../app/api';
import { Banner } from '../../shared/ui/Banner';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { ChevronRightIcon } from '../../shared/ui/icons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shashka, size, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

const CAT = 64;

/** A row of the profile that tells what the cat wears, and opens the wardrobe in a sheet. */
export function WardrobeRow({ wardrobe }: { wardrobe: Wardrobe }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const [opened, setOpened] = useState(false);
  const [setAccessory, result] = useSetAccessoryMutation();
  const open = wardrobe.items.filter((item) => item.unlocked).length;
  const summary =
    wardrobe.selected === 'none'
      ? t('wardrobe.rowNone', { open, total: wardrobe.items.length })
      : t('wardrobe.row', {
          open,
          total: wardrobe.items.length,
          worn: t(`wardrobe.worn_${wardrobe.selected}`),
        });

  return (
    <>
      <View>
        <View
          style={{
            position: 'absolute',
            left: shashka.offset,
            top: shashka.offset,
            right: -shashka.offset,
            bottom: -shashka.offset,
            borderRadius: radius.card,
            backgroundColor: colors.edge,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('wardrobe.title')}. ${summary}`}
          onPress={() => setOpened(true)}
          style={{
            minHeight: size.tapMin + space[4],
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            padding: space[3],
            borderRadius: radius.card,
            borderWidth: shashka.border,
            borderColor: colors.edge,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.button, { color: colors.text }]}>{t('wardrobe.title')}</Text>
            <Text style={[typography.small, { color: colors.text2 }]}>{summary}</Text>
          </View>
          <ChevronRightIcon color={colors.text2} />
        </Pressable>
      </View>

      {opened && (
        <BottomSheet label={t('wardrobe.title')} onClose={() => setOpened(false)}>
          <Text accessibilityRole="header" style={[typography.h2, { color: colors.text }]}>
            {t('wardrobe.title')}
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('wardrobe.title')}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignSelf: 'stretch' }}
          >
            {wardrobe.items.map((item) => {
              const worn = item.key === wardrobe.selected;
              const name = t(`wardrobe.items.${item.key}.name`);
              const hint = t(`wardrobe.items.${item.key}.hint`);
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="radio"
                  accessibilityLabel={`${name}. ${worn ? t('wardrobe.worn') : item.unlocked ? hint : `${hint}, ${t('wardrobe.locked')}`}`}
                  accessibilityState={{ selected: worn, disabled: !item.unlocked }}
                  disabled={!item.unlocked}
                  onPress={() => void setAccessory({ accessory: item.key as AccessoryKey })}
                  style={{
                    flexBasis: '30%',
                    flexGrow: 1,
                    minHeight: 120,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: space[1],
                    padding: space[2],
                    borderRadius: radius.card,
                    borderWidth: worn ? shashka.borderLarge : shashka.border,
                    borderStyle: item.unlocked ? 'solid' : 'dashed',
                    borderColor: worn ? colors.brand : colors.line,
                    backgroundColor: worn ? colors.brandTint : colors.surface,
                    opacity: item.unlocked ? 1 : 0.6,
                  }}
                >
                  <Mascot mood="idle" size={CAT} accessory={item.key} dark={scheme === 'dark'} />
                  <Text style={[typography.small, { color: colors.text }]}>{name}</Text>
                  <Text style={[typography.caption, { color: colors.text2, textAlign: 'center' }]}>
                    {worn ? t('wardrobe.worn') : hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {result.isError && <Banner>{t('wardrobe.error')}</Banner>}
        </BottomSheet>
      )}
    </>
  );
}
