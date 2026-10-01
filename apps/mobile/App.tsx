import { boardReducer, createBoardState } from '@kotgambit/board-controller';
import { MOODS } from '@kotgambit/mascot';
import { useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Provider } from 'react-redux';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeQuery } from './src/app/api';
import { useAppSelector } from './src/app/hooks';
import { store as appStore, type AppStore } from './src/app/store';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { SplashScreen } from './src/features/auth/SplashScreen';
import { useSignOut } from './src/features/auth/useSignOut';
import { Board } from './src/features/board/Board';
import { Mascot } from './src/features/mascot/Mascot';
import './src/shared/i18n';
import { Button } from './src/shared/ui/Button';
import { ThemeProvider, useTheme, type ThemePreference } from './src/theme/ThemeProvider';
import { radius, screenPadding, size, space, typography } from './src/theme/theme';

// A placeholder page to look at the finished parts until the real screens exist
function Sandbox({ onToggleTheme }: { onToggleTheme: () => void }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [board, dispatch] = useReducer(boardReducer, undefined, () => createBoardState());
  const { data: user } = useMeQuery();
  const signOut = useSignOut();

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
          {user && (
            <Text style={[typography.small, { color: colors.text2 }]}>
              {t('sandbox.signedInAs', { email: user.email })}
            </Text>
          )}
          <View style={styles.row}>
            <Button
              variant="secondary"
              label={t(scheme === 'light' ? 'sandbox.theme.dark' : 'sandbox.theme.light')}
              onPress={onToggleTheme}
            />
            <Button
              variant="secondary"
              label={t('sandbox.flip')}
              onPress={() => dispatch({ type: 'orientation/flip' })}
            />
            <Button
              variant="secondary"
              label={t('sandbox.signOut')}
              onPress={() => void signOut()}
            />
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

/** Checks the stored session first, then shows either the sign-in screen or the app. */
function Root({ onToggleTheme }: { onToggleTheme: () => void }) {
  // A 401 makes the base query try the refresh token from the Keystore before giving up
  const { isLoading } = useMeQuery();
  const status = useAppSelector((state) => state.auth.status);

  if (status === 'unknown' && isLoading) return <SplashScreen />;
  return status === 'authenticated' ? <Sandbox onToggleTheme={onToggleTheme} /> : <AuthScreen />;
}

/** `store` is only passed by tests, each of which needs a fresh one. */
function App({ store = appStore }: { store?: AppStore } = {}) {
  const [preference, setPreference] = useState<ThemePreference>('system');
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider preference={preference}>
          <Root onToggleTheme={() => setPreference(preference === 'dark' ? 'light' : 'dark')} />
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], paddingTop: space[2] },
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
