import { boardReducer, createBoardState } from '@kotgambit/board-controller';
import { MOODS } from '@kotgambit/mascot';
import { useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useLogoutMutation, useMeQuery } from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../shared/ui/Button';
import { Board } from '../board';
import { Mascot } from '../mascot/Mascot';
import { preferenceChanged } from '../theme/theme.slice';
import { useScheme } from '../theme/useScheme';

// A placeholder page to look at the finished parts until the real screens exist
export function SandboxPage() {
  const { t } = useTranslation();
  const [board, dispatch] = useReducer(boardReducer, undefined, () => createBoardState());
  const appDispatch = useAppDispatch();
  const scheme = useScheme();
  const status = useAppSelector((state) => state.auth.status);
  const { data: user } = useMeQuery(undefined, { skip: status !== 'authenticated' });
  const [logout] = useLogoutMutation();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-4 pr-6 tablet:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-h1">{t('app.title')}</h1>
        <p className="text-body text-text-2">{t('app.tagline')}</p>
        <p className="text-small text-text-muted">{t('sandbox.note')}</p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => appDispatch(preferenceChanged(scheme === 'light' ? 'dark' : 'light'))}
          >
            {t(scheme === 'light' ? 'sandbox.theme.dark' : 'sandbox.theme.light')}
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: 'orientation/flip' })}>
            {t('sandbox.flip')}
          </Button>
          {status === 'authenticated' ? (
            <>
              {user && (
                <span className="text-small text-text-2">
                  {t('sandbox.signedInAs', { email: user.email })}
                </span>
              )}
              <Button variant="secondary" onClick={() => void logout()}>
                {t('sandbox.signOut')}
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="flex min-h-11 items-center rounded-control border-2 border-edge bg-surface px-4 font-bold text-text shadow-shashka"
              >
                {t('sandbox.signIn')}
              </Link>
              <Link
                to="/register"
                className="flex min-h-11 items-center rounded-control border-2 border-edge bg-surface px-4 font-bold text-text shadow-shashka"
              >
                {t('sandbox.register')}
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-h2">{t('sandbox.board')}</h2>
        <Board state={board} dispatch={dispatch} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-h2">{t('sandbox.mascot')}</h2>
        <ul className="grid grid-cols-2 gap-4 tablet:grid-cols-3 laptop:grid-cols-5">
          {MOODS.map((mood) => (
            <li
              key={mood}
              className="flex flex-col items-center gap-1 rounded-card border-2 border-line bg-surface p-3"
            >
              <Mascot mood={mood} size={140} dark={scheme === 'dark'} animate />
              <span className="text-small text-text-2">{t(`mascot.mood.${mood}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
