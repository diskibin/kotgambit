import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Button } from '../../shared/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

interface PremiumNudgeProps {
  kind: 'puzzles' | 'analysis' | 'cards';
  onPremium: () => void;
  /** A smaller card inside a screen, instead of one that fills it. */
  compact?: boolean;
}

/**
 * What a free learner sees when a limit of the day is reached or a feature is Premium's: a sleepy cat, the
 * plain fact and the way to Premium. No red, no pressure (PLAN.md 14.2).
 */
export function PremiumNudge({ kind, onPremium, compact = false }: PremiumNudgeProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: space[3],
        padding: space[4],
        ...(compact
          ? {
              borderRadius: radius.card,
              borderWidth: 2,
              borderStyle: 'dashed' as const,
              borderColor: colors.sunDepth,
              backgroundColor: colors.sunTint,
            }
          : {}),
      }}
    >
      <Mascot mood="sleepy" size={compact ? 80 : 110} dark={scheme === 'dark'} />
      <Text
        accessibilityRole="header"
        style={[typography.h2, { color: colors.text, textAlign: 'center' }]}
      >
        {t(`limits.${kind}.title`)}
      </Text>
      <Text style={[typography.body, { color: colors.text2, textAlign: 'center' }]}>
        {t(`limits.${kind}.text`)}
      </Text>
      <Button variant="premium" label={t('limits.cta')} onPress={onPremium} />
    </View>
  );
}
