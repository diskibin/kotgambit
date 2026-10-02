import { useEffect, useState } from 'react';
import { BackHandler, StatusBar } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMeQuery } from './src/app/api';
import { useAppSelector } from './src/app/hooks';
import { store as appStore, type AppStore } from './src/app/store';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { RecoverScreen } from './src/features/auth/RecoverScreen';
import { SplashScreen } from './src/features/auth/SplashScreen';
import { CompleteScreen } from './src/features/lessons/CompleteScreen';
import { LessonScreen, type LessonResult } from './src/features/lessons/LessonScreen';
import { PathScreen } from './src/features/path/PathScreen';
import { PuzzleScreen } from './src/features/puzzles/PuzzleScreen';
import { PuzzlesScreen, type PuzzleRequest } from './src/features/puzzles/PuzzlesScreen';
import './src/shared/i18n';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

type Screen =
  | { name: 'path' }
  | { name: 'lesson'; id: string }
  | { name: 'done'; data: LessonResult }
  | { name: 'puzzles' }
  | { name: 'puzzle'; request: PuzzleRequest };

/** The signed-in app: the chapters, a lesson in focus mode, the finish screen and the puzzles. */
function SignedIn() {
  const [screen, setScreen] = useState<Screen>({ name: 'path' });

  // Behind the finish screen and the puzzle catalog there are the chapters, behind a puzzle the catalog.
  // The lesson asks before leaving on its own.
  useEffect(() => {
    if (screen.name !== 'done' && screen.name !== 'puzzles' && screen.name !== 'puzzle') return;
    const back: Screen = screen.name === 'puzzle' ? { name: 'puzzles' } : { name: 'path' };
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen(back);
      return true;
    });
    return () => subscription.remove();
  }, [screen.name]);

  if (screen.name === 'puzzles') {
    return (
      <PuzzlesScreen
        onOpen={(request) => setScreen({ name: 'puzzle', request })}
        onBack={() => setScreen({ name: 'path' })}
      />
    );
  }
  if (screen.name === 'puzzle') {
    return (
      <PuzzleScreen
        // Another mode or theme is another screen with fresh state
        key={`${screen.request.mode}:${screen.request.theme ?? ''}`}
        request={screen.request}
        onClose={() => setScreen({ name: 'puzzles' })}
      />
    );
  }

  if (screen.name === 'lesson') {
    return (
      <LessonScreen
        // A new id is a new lesson with fresh state
        key={screen.id}
        id={screen.id}
        onExit={() => setScreen({ name: 'path' })}
        onFinished={(data) => setScreen({ name: 'done', data })}
      />
    );
  }
  if (screen.name === 'done') {
    return (
      <CompleteScreen
        data={screen.data}
        onRepeat={(id) => setScreen({ name: 'lesson', id })}
        onNext={(id) => setScreen({ name: 'lesson', id })}
        onHome={() => setScreen({ name: 'path' })}
      />
    );
  }
  return (
    <PathScreen
      onOpenLesson={(id) => setScreen({ name: 'lesson', id })}
      onOpenPuzzles={() => setScreen({ name: 'puzzles' })}
    />
  );
}

/** Sign-in with the way to password recovery; the system Back button leaves recovery first. */
function SignedOut() {
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!recovering) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setRecovering(false);
      return true;
    });
    return () => subscription.remove();
  }, [recovering]);

  return recovering ? (
    <RecoverScreen onBack={() => setRecovering(false)} />
  ) : (
    <AuthScreen onForgot={() => setRecovering(true)} />
  );
}

/** Checks the stored session first, then shows either the sign-in screen or the app. */
function Root() {
  const { scheme } = useTheme();
  // A 401 makes the base query try the refresh token from the Keystore before giving up
  const { isLoading } = useMeQuery();
  const status = useAppSelector((state) => state.auth.status);

  return (
    <>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {status === 'unknown' && isLoading ? (
        <SplashScreen />
      ) : status === 'authenticated' ? (
        <SignedIn />
      ) : (
        <SignedOut />
      )}
    </>
  );
}

/** `store` is only passed by tests, each of which needs a fresh one. */
function App({ store = appStore }: { store?: AppStore } = {}) {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider preference="system">
          <Root />
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
