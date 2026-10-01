import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, shashka, space, typography } from '../../theme/theme';
import { useReducedMotion } from '../useReducedMotion';
import { BulbIcon, CheckIcon, RetryIcon } from './icons';

export type ReplyTone = 'neutral' | 'success' | 'oops' | 'hint' | 'info';

const TAIL = 18;
const POP_MS = 220;
const FADE_MS = 120;
const POP_FROM = 0.94;

interface ReplyCardProps {
  tone: ReplyTone;
  title: string;
  children?: ReactNode;
  /** The row of buttons under the text. */
  actions?: ReactNode;
  /** A small label next to the title, such as "1 из 3" for hints. */
  note?: string;
}

/**
 * The cat's reply under the board: the answer to what the learner just did, with the way to go on.
 * The tail points up, to the cat standing above the card. It replaces the bottom "Check" bar.
 */
export function ReplyCard({ tone, title, children, actions, note }: ReplyCardProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [appear] = useState(() => new Animated.Value(0));

  useEffect(() => {
    appear.setValue(0);
    const animation = Animated.timing(appear, {
      toValue: 1,
      duration: reducedMotion ? FADE_MS : POP_MS,
      easing: reducedMotion ? Easing.linear : Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [appear, reducedMotion, tone, title]);

  const look = {
    neutral: { bg: colors.surface, title: colors.text, badge: null },
    success: { bg: colors.mintTint, title: colors.mintText, badge: colors.mint },
    oops: { bg: colors.coralTint, title: colors.coralText, badge: colors.coral },
    hint: { bg: colors.skyTint, title: colors.skyText, badge: colors.sky },
    info: { bg: colors.sunTint, title: colors.sunText, badge: colors.sun },
  }[tone];

  const scale = reducedMotion
    ? 1
    : appear.interpolate({ inputRange: [0, 1], outputRange: [POP_FROM, 1] });

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{ opacity: appear, transform: [{ scale }] }}
    >
      {/* The offset underlay is the "shashka" shadow of a large element */}
      <View style={styles.wrap}>
        <View
          style={[styles.underlay, { backgroundColor: colors.edge, borderRadius: radius.reply }]}
        />
        <View
          style={[
            styles.card,
            { backgroundColor: look.bg, borderColor: colors.edge, borderRadius: radius.reply },
          ]}
        >
          <View style={[styles.tail, { backgroundColor: look.bg, borderColor: colors.edge }]} />
          <View style={styles.titleRow}>
            {look.badge && (
              <View
                style={[styles.badge, { backgroundColor: look.badge, borderColor: colors.edge }]}
              >
                {tone === 'success' && <CheckIcon size={18} color={colors.onAccent} />}
                {tone === 'oops' && <RetryIcon size={18} color={colors.onAccent} />}
                {tone === 'hint' && <BulbIcon size={18} color={colors.onAccent} />}
              </View>
            )}
            <Text style={[typography.h3, { color: look.title, flex: 1 }]}>{title}</Text>
            {note && <Text style={[typography.small, { color: colors.skyText }]}>{note}</Text>}
          </View>
          {children ? (
            <Text style={[typography.body, { color: colors.text, fontFamily: 'Onest-SemiBold' }]}>
              {children}
            </Text>
          ) : null}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingRight: shashka.offsetLarge, paddingBottom: shashka.offsetLarge },
  underlay: {
    position: 'absolute',
    left: shashka.offsetLarge,
    top: shashka.offsetLarge,
    right: 0,
    bottom: 0,
  },
  card: {
    borderWidth: shashka.borderLarge,
    padding: space[4],
    gap: space[3],
  },
  tail: {
    position: 'absolute',
    top: -TAIL / 2 - shashka.borderLarge,
    left: 28,
    width: TAIL,
    height: TAIL,
    borderLeftWidth: shashka.borderLarge,
    borderTopWidth: shashka.borderLarge,
    transform: [{ rotate: '45deg' }],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] },
});
