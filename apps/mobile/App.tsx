import { boardReducer, createBoardState } from '@kotgambit/board-controller';
import { MOODS } from '@kotgambit/mascot';
import { useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Provider } from 'react-redux';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { store } from './src/app/store';
import { Board } from './src/features/board/Board';
import { Mascot } from './src/features/mascot/Mascot';
import './src/shared/i18n';
import { ThemeProvider, useTheme, type ThemePreference } from './src/theme/ThemeProvider';
import { radius, screenPadding, shashka, size, space, typography } from './src/theme/theme';

// A placeholder page to look at the finished parts until the real screens exist
function Sandbox({ onToggleTheme }: { onToggleTheme: () => void }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [board, dispatch] = useReducer(boardReducer, undefined, () => createBoardState());

  const button = (label: string, onPress: () => void) => (
    <View style={styles.buttonWrap}>
      <View style={[styles.buttonShadow, { backgroundColor: colors.edge }]} />
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.edge,
            transform: pressed
              ? [{ translateX: shashka.pressShift }, { translateY: shashka.pressShift }]
              : [],
          },
        ]}
      >
        <Text style={[typography.button, { color: colors.text }]}>{label}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={{
          padding: screenPadding,
          paddingTop: insets.top + screenPadding,
          paddingBottom: insets.bottom + screenPadding,
          gap: space[6],
        }}
      >
        <View style={{ gap: space[2] }}>
          <Text style={[typography.display, { color: colors.text }]}>{t('app.title')}</Text>
          <Text style={[typography.body, { color: colors.text2 }]}>{t('app.tagline')}</Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>{t('sandbox.note')}</Text>
          <View style={styles.row}>
            {button(
              t(scheme === 'light' ? 'sandbox.theme.dark' : 'sandbox.theme.light'),
              onToggleTheme,
            )}
            {button(t('sandbox.flip'), () => dispatch({ type: 'orientation/flip' }))}
          </View>
        </View>

        <View style={{ gap: space[3] }}>
          <Text style={[typography.h1, { color: colors.text }]}>{t('sandbox.board')}</Text>
          <Board state={board} dispatch={dispatch} size={size.board} />
        </View>

        <View style={{ gap: space[3] }}>
          <Text style={[typography.h1, { color: colors.text }]}>{t('sandbox.mascot')}</Text>
          <View style={styles.cats}>
            {MOODS.map((mood) => (
              <View
                key={mood}
                style={[styles.cat, { backgroundColor: colors.surface, borderColor: colors.line }]}
              >
                <Mascot mood={mood} size={104} dark={scheme === 'dark'} animate />
                <Text style={[typography.small, { color: colors.text2 }]}>
                  {t(`mascot.mood.${mood}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function App() {
  const [preference, setPreference] = useState<ThemePreference>('light');
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider preference={preference}>
          <Sandbox onToggleTheme={() => setPreference(preference === 'light' ? 'dark' : 'light')} />
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], paddingTop: space[2] },
  buttonWrap: { paddingRight: shashka.offset, paddingBottom: shashka.offset },
  buttonShadow: {
    position: 'absolute',
    left: shashka.offset,
    top: shashka.offset,
    right: 0,
    bottom: 0,
    borderRadius: radius.control,
  },
  button: {
    minHeight: size.tapMin,
    paddingHorizontal: space[4],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: shashka.border,
  },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  cat: {
    width: 140,
    alignItems: 'center',
    gap: space[1],
    padding: space[3],
    borderRadius: radius.card,
    borderWidth: 2,
  },
});

export default App;
