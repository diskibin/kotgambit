import type { CheckoutResponse } from '@kotgambit/contracts';
import { useEffect, useState, type ReactElement } from 'react';
import { BackHandler, StatusBar, View } from 'react-native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMeQuery } from './src/app/api';
import { useAppDispatch, useAppSelector } from './src/app/hooks';
import { store as appStore, type AppStore } from './src/app/store';
import { AuthScreen } from './src/features/auth/AuthScreen';
import { RecoverScreen } from './src/features/auth/RecoverScreen';
import { SplashScreen } from './src/features/auth/SplashScreen';
import { CompleteScreen } from './src/features/lessons/CompleteScreen';
import { LessonScreen, type LessonResult } from './src/features/lessons/LessonScreen';
import { AnalysisScreen } from './src/features/analysis/AnalysisScreen';
import { ReviewScreen } from './src/features/analysis/ReviewScreen';
import { CardsScreen } from './src/features/profile/CardsScreen';
import { ProfileScreen } from './src/features/profile/ProfileScreen';
import { CheckoutScreen } from './src/features/premium/CheckoutScreen';
import { PaymentStatusScreen } from './src/features/premium/PaymentStatusScreen';
import { PremiumScreen } from './src/features/premium/PremiumScreen';
import { ApplyOnboarding } from './src/features/onboarding/ApplyOnboarding';
import { OnboardingScreen } from './src/features/onboarding/OnboardingScreen';
import { firstLessonOpened } from './src/features/onboarding/onboarding.slice';
import { ErrorBoundary } from './src/features/system/ErrorBoundary';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { PathScreen } from './src/features/path/PathScreen';
import { BotsScreen } from './src/features/play/BotsScreen';
import { GameScreen } from './src/features/play/GameScreen';
import { PuzzleScreen } from './src/features/puzzles/PuzzleScreen';
import { PuzzlesScreen, type PuzzleRequest } from './src/features/puzzles/PuzzlesScreen';
import { TabBar, type TabId } from './src/shared/ui/TabBar';
import './src/shared/i18n';
import { useUiPreferences } from './src/features/settings/useUiPreferences';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

type Screen =
  | { name: 'path' }
  | { name: 'lesson'; id: string }
  | { name: 'done'; data: LessonResult }
  | { name: 'puzzles' }
  | { name: 'puzzle'; request: PuzzleRequest }
  | { name: 'bots' }
  | { name: 'game'; id: string }
  | { name: 'analysis' }
  | { name: 'review'; id: string }
  | { name: 'profile' }
  | { name: 'cards' }
  | { name: 'settings' }
  | { name: 'premium' }
  | { name: 'checkout'; checkout: CheckoutResponse }
  | { name: 'payment'; paymentId: string };

// The screens that live under a tab, and where a tab leads
const TAB_OF: Partial<Record<Screen['name'], TabId>> = {
  path: 'path',
  puzzles: 'tasks',
  bots: 'play',
  review: 'play',
  analysis: 'analysis',
  profile: 'profile',
  settings: 'profile',
};
const SCREEN_OF: Record<TabId, Screen> = {
  path: { name: 'path' },
  tasks: { name: 'puzzles' },
  play: { name: 'bots' },
  analysis: { name: 'analysis' },
  profile: { name: 'profile' },
};

/** The signed-in app: the chapters, a lesson in focus mode, the finish screen and the puzzles. */
function SignedIn() {
  const dispatch = useAppDispatch();
  const firstLesson = useAppSelector((state) => state.onboarding.firstLesson);
  // A learner who came from the first steps starts in the chapter they were shown
  const [screen, setScreen] = useState<Screen>(
    firstLesson ? { name: 'lesson', id: firstLesson } : { name: 'path' },
  );
  useEffect(() => {
    if (firstLesson) dispatch(firstLessonOpened());
  }, [firstLesson, dispatch]);

  // Behind the finish screen and the puzzle catalog there are the chapters, behind a puzzle the catalog.
  // The lesson asks before leaving on its own.
  useEffect(() => {
    if (
      screen.name !== 'done' &&
      screen.name !== 'puzzles' &&
      screen.name !== 'puzzle' &&
      screen.name !== 'bots' &&
      screen.name !== 'analysis' &&
      screen.name !== 'review' &&
      screen.name !== 'profile' &&
      screen.name !== 'cards' &&
      screen.name !== 'settings' &&
      screen.name !== 'premium' &&
      screen.name !== 'payment'
    ) {
      return;
    }
    const back: Screen =
      screen.name === 'puzzle'
        ? { name: 'puzzles' }
        : screen.name === 'review'
          ? { name: 'bots' }
          : screen.name === 'cards' || screen.name === 'settings'
            ? { name: 'profile' }
            : screen.name === 'payment'
              ? { name: 'premium' }
              : { name: 'path' };
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen(back);
      return true;
    });
    return () => subscription.remove();
  }, [screen.name]);

  const render = (): ReactElement => {
    if (screen.name === 'premium') {
      return (
        <PremiumScreen
          onBack={() => setScreen({ name: 'path' })}
          onCheckout={(checkout) => setScreen({ name: 'checkout', checkout })}
        />
      );
    }
    // The payment page is in focus mode and asks before leaving on its own
    if (screen.name === 'checkout') {
      return (
        <CheckoutScreen
          key={screen.checkout.paymentId}
          checkout={screen.checkout}
          onReturn={() => setScreen({ name: 'payment', paymentId: screen.checkout.paymentId })}
          onClose={() => setScreen({ name: 'payment', paymentId: screen.checkout.paymentId })}
        />
      );
    }
    if (screen.name === 'payment') {
      return (
        <PaymentStatusScreen
          paymentId={screen.paymentId}
          onDone={() => setScreen({ name: 'path' })}
          onRetry={() => setScreen({ name: 'premium' })}
        />
      );
    }
    if (screen.name === 'profile') {
      return (
        <ProfileScreen
          onCards={() => setScreen({ name: 'cards' })}
          onTheme={(theme) => setScreen({ name: 'puzzle', request: { mode: 'theme', theme } })}
          onPremium={() => setScreen({ name: 'premium' })}
          onSettings={() => setScreen({ name: 'settings' })}
        />
      );
    }
    if (screen.name === 'settings') {
      return (
        <SettingsScreen
          onBack={() => setScreen({ name: 'profile' })}
          onPremium={() => setScreen({ name: 'premium' })}
        />
      );
    }
    if (screen.name === 'cards') {
      return (
        <CardsScreen
          onClose={() => setScreen({ name: 'profile' })}
          onPremium={() => setScreen({ name: 'premium' })}
        />
      );
    }
    if (screen.name === 'analysis')
      return <AnalysisScreen onPremium={() => setScreen({ name: 'premium' })} />;
    if (screen.name === 'review') {
      return (
        <ReviewScreen
          id={screen.id}
          onClose={() => setScreen({ name: 'bots' })}
          onCards={() => setScreen({ name: 'cards' })}
          onPremium={() => setScreen({ name: 'premium' })}
        />
      );
    }
    if (screen.name === 'bots') {
      return <BotsScreen onStart={(id) => setScreen({ name: 'game', id })} />;
    }
    // The game asks before leaving on its own, like a lesson
    if (screen.name === 'game') {
      return (
        <GameScreen
          // A new game is a new screen with fresh state
          key={screen.id}
          id={screen.id}
          onClose={() => setScreen({ name: 'bots' })}
          onNewGame={(id) => setScreen({ name: 'game', id })}
          onReview={(id) => setScreen({ name: 'review', id })}
        />
      );
    }
    if (screen.name === 'puzzles') {
      return <PuzzlesScreen onOpen={(request) => setScreen({ name: 'puzzle', request })} />;
    }
    if (screen.name === 'puzzle') {
      return (
        <PuzzleScreen
          // Another mode or theme is another screen with fresh state
          key={`${screen.request.mode}:${screen.request.theme ?? ''}`}
          request={screen.request}
          onClose={() => setScreen({ name: 'puzzles' })}
          onPremium={() => setScreen({ name: 'premium' })}
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
        onOpenTasks={() => setScreen({ name: 'puzzles' })}
      />
    );
  };

  const tab = TAB_OF[screen.name];
  const content = render();
  if (!tab) return content;
  // The five places keep the bar of the design at the bottom, the focus screens do not have it
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>{content}</View>
      <TabBar active={tab} onSelect={(next) => setScreen(SCREEN_OF[next])} />
    </View>
  );
}

type SignedOutScreen = 'start' | 'login' | 'register' | 'recover';

/** The first steps, then sign-in or sign-up with the way to password recovery; the system Back button goes one step back. */
function SignedOut() {
  const hadSession = useAppSelector((state) => state.onboarding.hadSession);
  const [screen, setScreen] = useState<SignedOutScreen>(hadSession ? 'login' : 'start');

  useEffect(() => {
    if (screen === 'start') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen(screen === 'recover' ? 'login' : 'start');
      return true;
    });
    return () => subscription.remove();
  }, [screen]);

  if (screen === 'start') {
    return (
      <OnboardingScreen
        onAccount={() => setScreen('register')}
        onSignIn={() => setScreen('login')}
      />
    );
  }
  if (screen === 'recover') return <RecoverScreen onBack={() => setScreen('login')} />;
  return (
    <AuthScreen
      // The way in decides the tab it opens on
      key={screen}
      initialMode={screen}
      onForgot={() => setScreen('recover')}
    />
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
      <ApplyOnboarding />
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

/** The theme the learner chose, or the one of the system until they choose. */
function ThemedRoot() {
  const { theme } = useUiPreferences();
  return (
    <ThemeProvider preference={theme}>
      <Root />
    </ThemeProvider>
  );
}

/** `store` is only passed by tests, each of which needs a fresh one. */
function App({ store = appStore }: { store?: AppStore } = {}) {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <SafeAreaProvider>
          <ThemedRoot />
        </SafeAreaProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
