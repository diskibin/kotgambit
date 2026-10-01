import { Route, Routes } from 'react-router';
import { useMeQuery } from './app/api';
import { AuthPage } from './features/auth/AuthPage';
import { RecoverPage } from './features/auth/RecoverPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { CompletePage } from './features/lessons/CompletePage';
import { LessonPage } from './features/lessons/LessonPage';
import { PathPage } from './features/path/PathPage';
import { SandboxPage } from './features/sandbox/SandboxPage';
import { ThemeSync } from './features/theme/ThemeSync';

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
        <Route path="/sandbox" element={<SandboxPage />} />
        <Route path="*" element={<PathPage />} />
      </Routes>
    </>
  );
}
