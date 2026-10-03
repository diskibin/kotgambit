import { apiErrorOf } from '@kotgambit/contracts';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useBotsQuery, useGameQuery } from '../../app/api';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../shared/ui/Button';
import { Mascot } from '../mascot/Mascot';
import { useScheme } from '../theme/useScheme';
import { GameScreen } from './GameScreen';

/** The game in focus mode: reads the game from the server and hands it to the screen. */
export function GamePage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const scheme = useScheme();
  const authStatus = useAppSelector((state) => state.auth.status);
  const signedIn = authStatus === 'authenticated';
  const loaded = useAppSelector((state) => state.gameSession.game);
  // A game that was left and opened again is read afresh, the cached copy may be behind
  const game = useGameQuery(id, { skip: !signedIn, refetchOnMountOrArgChange: true });
  const bots = useBotsQuery(undefined, { skip: !signedIn });

  useEffect(() => {
    if (game.data && loaded?.id !== game.data.id) {
      dispatch({ type: 'game/loaded', game: game.data });
    }
  }, [game.data, loaded?.id, dispatch]);

  useEffect(() => () => void dispatch({ type: 'game/exited' }), [dispatch]);

  if (authStatus === 'anonymous') return <Navigate to="/login" replace />;

  const bot = bots.data?.bots.find((candidate) => candidate.id === loaded?.botId);
  if (loaded?.id === id && bot) return <GameScreen bot={bot} />;

  const failed = game.isError || bots.isError;
  const message = failed ? (apiErrorOf(game.error)?.message ?? t('play.loadError')) : null;

  return (
    <div
      role={failed ? undefined : 'status'}
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-text"
    >
      <Mascot mood={failed ? 'oops' : 'thinking'} size={140} dark={scheme === 'dark'} animate />
      <h1 className="m-0 max-w-[600px] font-heading text-[26px] leading-9 font-bold">
        {message ?? t('play.loading')}
      </h1>
      {failed && (
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={() => void navigate('/play')}>
            {t('play.game.close')}
          </Button>
          <Button
            onClick={() => {
              void game.refetch();
              void bots.refetch();
            }}
          >
            {t('play.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}
