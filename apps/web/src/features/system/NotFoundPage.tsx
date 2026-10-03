import { createBoardState } from '@kotgambit/board-controller';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Board } from '../board';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { Button } from '../../shared/ui/Button';

const NOOP = () => undefined;

/** An address the site does not have: a way back, said by the cat. */
export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dark = useScheme() === 'dark';
  const board = useMemo(
    () => createBoardState({ fen: '8/8/8/8/8/8/8/8 w - - 0 1', orientation: 'w' }),
    [],
  );
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 py-10 text-center text-text">
      <div
        aria-hidden="true"
        className="flex items-center gap-3 font-heading text-[96px] leading-none font-bold text-brand tablet:text-[160px]"
      >
        4
        <span inert className="w-16 tablet:w-28">
          <Board state={board} dispatch={NOOP} coords={false} disabled onSquarePress={NOOP} />
        </span>
        4
      </div>
      <span className="sr-only">{t('system.notFound.code')}</span>
      <Mascot mood="thinking" size={150} dark={dark} />
      <h1 className="m-0 font-heading text-[28px] leading-9 font-bold tablet:text-[40px] tablet:leading-[48px]">
        {t('system.notFound.title')}
      </h1>
      <p className="m-0 max-w-[600px] text-[19px] leading-7 font-semibold text-text-2">
        {t('system.notFound.text')}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" large onClick={() => void navigate(-1)}>
          {t('system.notFound.back')}
        </Button>
        <Link
          to="/"
          className="flex h-14 items-center justify-center rounded-card border-2 border-edge bg-brand px-4 text-[18px] font-extrabold text-on-brand no-underline shadow-shashka"
        >
          {t('system.notFound.home')}
        </Link>
      </div>
    </main>
  );
}
