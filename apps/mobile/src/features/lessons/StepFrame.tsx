import type { Mood } from '@kotgambit/mascot';
import type { ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { screenPadding, shashka, space, typography } from '../../theme/theme';
import { Mascot } from '../mascot/Mascot';

const CAT_SIZE = 60;
const MAX_BOARD = 420;

/** The width a board can take here: the screen minus the margins and the room for its shadow. */
export function useBoardSize(): number {
  const { width } = useWindowDimensions();
  return Math.min(width - screenPadding * 2 - shashka.offsetLarge, MAX_BOARD);
}

interface StepFrameProps {
  /** "Основы · глава 9 · шаг 2 из 5" */
  caption: string;
  title: string;
  mood: Mood;
  board?: ReactNode;
  children: ReactNode;
}

/**
 * Every step has the same frame, top to bottom: the caption, the title, the board, the cat on the
 * left above the reply card and the card itself (components.md, ReplyCard on mobile).
 */
export function StepFrame({ caption, title, mood, board, children }: StepFrameProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: screenPadding,
        paddingBottom: insets.bottom + screenPadding,
        gap: space[3],
      }}
    >
      <Text style={[typography.small, { color: colors.text2 }]}>{caption}</Text>
      <Text accessibilityRole="header" style={[typography.h1, { color: colors.text }]}>
        {title}
      </Text>
      {board}
      <View style={{ paddingLeft: space[2] }}>
        <Mascot mood={mood} size={CAT_SIZE} dark={scheme === 'dark'} animate />
      </View>
      {children}
    </ScrollView>
  );
}
