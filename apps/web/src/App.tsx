import { Route, Routes } from 'react-router';
import { useMeQuery } from './app/api';
import { AdminPage } from './features/admin/AdminPage';
import { Analytics } from './features/analytics/Analytics';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { ReviewPage } from './features/analysis/ReviewPage';
import { CardsPage } from './features/profile/CardsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { BillingReturnPage } from './features/premium/BillingReturnPage';
import { PremiumPage } from './features/premium/PremiumPage';
import { AuthPage } from './features/auth/AuthPage';
import { RecoverPage } from './features/auth/RecoverPage';
import { UnsubscribePage } from './features/auth/UnsubscribePage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { LegalPage } from './features/legal/LegalPage';
import { CompletePage } from './features/lessons/CompletePage';
import { LessonPage } from './features/lessons/LessonPage';
import { BotsPage } from './features/play/BotsPage';
import { GamePage } from './features/play/GamePage';
import { PathPage } from './features/path/PathPage';
import { PuzzlePage } from './features/puzzles/PuzzlePage';
import { PuzzlesPage } from './features/puzzles/PuzzlesPage';
import { SandboxPage } from './features/sandbox/SandboxPage';
import { LandingPage } from './features/landing/LandingPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { ApplyOnboarding } from './features/onboarding/ApplyOnboarding';
import { NotFoundPage } from './features/system/NotFoundPage';
import { OfflineBanner } from './features/system/OfflineBanner';
import { ThemeSync } from './features/theme/ThemeSync';

export function App() {
  // Restores the session after a reload: a 401 makes the base query try the refresh cookie first
  useMeQuery();

  return (
    <>
      <ThemeSync />
      <Analytics />
      <ApplyOnboarding />
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/:step" element={<OnboardingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/reset" element={<RecoverPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/offer" element={<LegalPage document="offer" />} />
        <Route path="/privacy" element={<LegalPage document="privacy" />} />
        <Route path="/lesson/:id" element={<LessonPage />} />
        <Route path="/lesson/:id/done" element={<CompletePage />} />
        <Route path="/puzzles" element={<PuzzlesPage />} />
        <Route path="/puzzles/solve" element={<PuzzlePage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/billing/return" element={<BillingReturnPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/review/:id" element={<ReviewPage />} />
        <Route path="/play" element={<BotsPage />} />
        <Route path="/play/:id" element={<GamePage />} />
        <Route path="/sandbox" element={<SandboxPage />} />
        <Route path="/learn" element={<PathPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
