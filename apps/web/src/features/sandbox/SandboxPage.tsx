import { boardReducer, createBoardState } from '@kotgambit/board-controller';
import { MOODS } from '@kotgambit/mascot';
import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Board } from './features/board';
import { Mascot } from './features/mascot/Mascot';

type Theme = 'light' | 'dark';

// A placeholder page to look at the finished parts until the real screens exist
export function App() {
  const { t } = useTranslation();
  const [board, dispatch] = useReducer(boardReducer, undefined, () => createBoardState());
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  const buttonClass =
    'min-h-11 rounded-control border-2 border-edge bg-surface px-4 font-bold text-text shadow-shashka active:translate-x-press active:translate-y-press active:shadow-none';

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-4 pr-6 tablet:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-h1">{t('app.title')}</h1>
        <p className="text-body text-text-2">{t('app.tagline')}</p>
        <p className="text-small text-text-muted">{t('sandbox.note')}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {t(theme === 'light' ? 'sandbox.theme.dark' : 'sandbox.theme.light')}
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => dispatch({ type: 'orientation/flip' })}
          >
            {t('sandbox.flip')}
          </button>
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
              <Mascot mood={mood} size={140} dark={theme === 'dark'} animate />
              <span className="text-small text-text-2">{t(`mascot.mood.${mood}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
