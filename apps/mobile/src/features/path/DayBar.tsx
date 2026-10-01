import type { ProgressSummary } from '@kotgambit/contracts';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { shashka, space, typography } from '../../theme/theme';
import { Piece } from '../board/Piece';

const CELLS = 10;
const SECONDS_IN_MINUTE = 60;
const CELL_WIDTH = 16;
const CELL_HEIGHT = 18;

/**
 * "День конём": ten board squares, one for every tenth of the daily goal, with the knight standing
 * on the last filled one. The label is one line under the bar on a phone.
 */
export function DayBar({ progress }: { progress: ProgressSummary }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { todaySeconds, goalSeconds, streakDays } = progress;
  const goalMinutes = Math.round(goalSeconds / SECONDS_IN_MINUTE);
  const doneMinutes = Math.floor(todaySeconds / SECONDS_IN_MINUTE);
  const filled = Math.min(CELLS, Math.floor((todaySeconds / goalSeconds) * CELLS));
  const reached = todaySeconds >= goalSeconds;

  const streak =
    streakDays === 0 ? t('dayBar.streakNone') : t('dayBar.streak', { count: streakDays });
  const minutes = reached
    ? t('dayBar.reached')
    : t('dayBar.minutes', { done: doneMinutes, goal: goalMinutes });

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={t('dayBar.label', { done: doneMinutes, goal: goalMinutes, streak })}
      style={{ gap: space[1] }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignSelf: 'flex-start',
          overflow: 'hidden',
          borderRadius: 9,
          borderWidth: shashka.border,
          borderColor: colors.edge,
        }}
      >
        {Array.from({ length: CELLS }, (_, index) => (
          <View
            key={index}
            style={{
              width: CELL_WIDTH,
              height: CELL_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                index < filled ? (index % 2 === 0 ? colors.boardA : colors.boardB) : colors.surface,
            }}
          >
            {index === filled - 1 && <Piece color="w" type="n" size={CELL_HEIGHT} />}
          </View>
        ))}
      </View>
      <Text style={[typography.caption, { color: colors.text }]}>
        {minutes} · <Text style={{ color: colors.flameText }}>{streak}</Text>
      </Text>
    </View>
  );
}
