import { Navigate, Route, Routes } from 'react-router';
import { useMeQuery } from './app/api';
import { useAppSelector } from './app/hooks';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { ReviewPage } from './features/analysis/ReviewPage';
import { CardsPage } from './features/profile/CardsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { BillingReturnPage } from './features/premium/BillingReturnPage';
import { PremiumPage } from './features/premium/PremiumPage';
import { AuthPage } from './features/auth/AuthPage';
import { RecoverPage } from './features/auth/RecoverPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { CompletePage } from './features/lessons/CompletePage';
import { LessonPage } from './features/lessons/LessonPage';
import { BotsPage } from './features/play/BotsPage';
import { GamePage } from './features/play/GamePage';
import { PathPage } from './features/path/PathPage';
import { PuzzlePage } from './features/puzzles/PuzzlePage';
import { PuzzlesPage } from './features/puzzles/PuzzlesPage';
import { SandboxPage } from './features/sandbox/SandboxPage';
import { ThemeSync } from './features/theme/ThemeSync';

/** The address of the site itself and of anything unknown: the chapters for a learner, the sign-in for a visitor. */
function HomeRedirect() {
  const status = useAppSelector((state) => state.auth.status);
  if (status === 'unknown') return null;
  return <Navigate to={status === 'authenticated' ? '/learn' : '/login'} replace />;
}

export function App() {
  // Restores the session after a reload: a 401 makes the base query try the refresh cookie first
  useMeQuery();

  return (
    <>
      <ThemeSync />
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/reset" element={<RecoverPage />} />
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/lesson/:id" element={<LessonPage />} />
        <Route path="/lesson/:id/done" element={<CompletePage />} />
        <Route path="/puzzles" element={<PuzzlesPage />} />
        <Route path="/puzzles/solve" element={<PuzzlePage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/billing/return" element={<BillingReturnPage />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/review/:id" element={<ReviewPage />} />
        <Route path="/play" element={<BotsPage />} />
        <Route path="/play/:id" element={<GamePage />} />
        <Route path="/sandbox" element={<SandboxPage />} />
        <Route path="/learn" element={<PathPage />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </>
  );
}
