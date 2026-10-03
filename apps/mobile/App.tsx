import type { CheckoutResponse } from '@kotgambit/contracts';
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
import { AnalysisScreen } from './src/features/analysis/AnalysisScreen';
import { ReviewScreen } from './src/features/analysis/ReviewScreen';
import { CardsScreen } from './src/features/profile/CardsScreen';
import { ProfileScreen } from './src/features/profile/ProfileScreen';
import { CheckoutScreen } from './src/features/premium/CheckoutScreen';
import { PaymentStatusScreen } from './src/features/premium/PaymentStatusScreen';
import { PremiumScreen } from './src/features/premium/PremiumScreen';
import { PathScreen } from './src/features/path/PathScreen';
import { BotsScreen } from './src/features/play/BotsScreen';
import { GameScreen } from './src/features/play/GameScreen';
import { PuzzleScreen } from './src/features/puzzles/PuzzleScreen';
import { PuzzlesScreen, type PuzzleRequest } from './src/features/puzzles/PuzzlesScreen';
import './src/shared/i18n';
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
  | { name: 'premium' }
  | { name: 'checkout'; checkout: CheckoutResponse }
  | { name: 'payment'; paymentId: string };

/** The signed-in app: the chapters, a lesson in focus mode, the finish screen and the puzzles. */
function SignedIn() {
  const [screen, setScreen] = useState<Screen>({ name: 'path' });

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
          : screen.name === 'cards'
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
        onBack={() => setScreen({ name: 'path' })}
        onCards={() => setScreen({ name: 'cards' })}
        onTheme={(theme) => setScreen({ name: 'puzzle', request: { mode: 'theme', theme } })}
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
    return (
      <AnalysisScreen
        onBack={() => setScreen({ name: 'path' })}
        onPremium={() => setScreen({ name: 'premium' })}
      />
    );
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
    return (
      <BotsScreen
        onStart={(id) => setScreen({ name: 'game', id })}
        onBack={() => setScreen({ name: 'path' })}
      />
    );
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
      onOpenPuzzles={() => setScreen({ name: 'puzzles' })}
      onOpenPlay={() => setScreen({ name: 'bots' })}
      onOpenAnalysis={() => setScreen({ name: 'analysis' })}
      onOpenProfile={() => setScreen({ name: 'profile' })}
      onOpenPremium={() => setScreen({ name: 'premium' })}
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
