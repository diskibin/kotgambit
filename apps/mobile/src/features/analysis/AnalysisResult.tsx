import type { PositionAnalysis } from '@kotgambit/contracts';
import { formatLine, formatScore, whiteShare } from '@kotgambit/game-player';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shashka, space, typography } from '../../theme/theme';

const SCALE_HEIGHT = 16;
const MIN_SEGMENT = 12;

/** The evaluation and the scale on top, then the chances, the best move and the lines of the position. */
export function AnalysisResult({ analysis }: { analysis: PositionAnalysis }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const share = whiteShare(analysis.score);
  const { outlook } = analysis;
  const segments = [
    { key: 'white', percent: outlook.white, background: '#FFFFFF', color: colors.edge },
    { key: 'draw', percent: outlook.draw, background: colors.surface2, color: colors.text },
    { key: 'black', percent: outlook.black, background: colors.edge, color: '#FFFFFF' },
  ] as const;

  return (
    <View
      style={{
        gap: space[3],
        padding: space[3],
        borderRadius: radius.card,
        borderWidth: shashka.border,
        borderColor: colors.edge,
        backgroundColor: colors.surface,
      }}
    >
      <View
        accessible
        accessibilityLabel={`${t('analysis.result.score', { score: formatScore(analysis.score) })}. ${analysis.headline}. ${analysis.detail}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
      >
        <View
          style={{
            borderRadius: radius.control,
            borderWidth: shashka.border,
            borderColor: colors.edge,
            backgroundColor: colors.surface2,
            paddingHorizontal: space[3],
            paddingVertical: space[2],
          }}
        >
          <Text style={[typography.h2, { color: colors.text }]}>{formatScore(analysis.score)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>
            {analysis.headline}
          </Text>
          <Text style={[typography.small, { color: colors.text2 }]}>{analysis.detail}</Text>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('analysis.result.scale', { white: share })}
        accessibilityValue={{ min: 0, max: 100, now: share }}
        style={{
          flexDirection: 'row',
          height: SCALE_HEIGHT,
          overflow: 'hidden',
          borderRadius: SCALE_HEIGHT,
          borderWidth: shashka.border,
          borderColor: colors.edge,
          backgroundColor: colors.edge,
        }}
      >
        <View style={{ width: `${share}%`, backgroundColor: '#FFFFFF' }} />
      </View>

      <View style={{ gap: space[2] }}>
        <Text style={[typography.small, { color: colors.text }]}>
          {t('analysis.result.outlook')}
        </Text>
        <View style={{ flexDirection: 'row', gap: space[1] }}>
          {segments.map(({ key, percent, background, color }) => (
            <View
              key={key}
              style={{
                flexGrow: Math.max(percent, MIN_SEGMENT),
                borderRadius: radius.control,
                borderWidth: shashka.border,
                borderColor: colors.edge,
                backgroundColor: background,
                paddingVertical: space[1],
                alignItems: 'center',
              }}
            >
              <Text style={[typography.caption, { color }]}>
                {t(`analysis.result.${key}`)} {percent}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {analysis.best && (
        <View
          style={{
            gap: space[1],
            padding: space[3],
            borderRadius: radius.card,
            backgroundColor: colors.mintTint,
          }}
        >
          <Text
            style={[typography.small, { color: colors.mintText }]}
          >{`★ ${analysis.best.san}`}</Text>
          <Text style={[typography.small, { color: colors.text }]}>
            {t('analysis.result.best')}: {analysis.best.explanation}
          </Text>
        </View>
      )}

      {analysis.lines.length > 0 && (
        <View style={{ gap: space[2] }}>
          <Text style={[typography.small, { color: colors.text }]}>
            {t('analysis.result.lines')}
          </Text>
          {analysis.lines.map((line, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: space[3] }}>
              <Text style={[typography.small, { color: colors.text, width: 52 }]}>
                {formatScore(line.score)}
              </Text>
              <Text style={[typography.small, { color: colors.text, flex: 1 }]}>
                {formatLine(analysis.fen, line.san)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
