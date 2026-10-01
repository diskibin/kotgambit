import { sessionEnded } from '@kotgambit/api-client';
import { useLogoutMutation } from '../../app/api';
import { useAppDispatch } from '../../app/hooks';
import { clearRefreshToken, getRefreshToken } from '../../app/refreshTokenStorage';

/** Revokes the session on the server, then forgets it here even if the server could not be reached. */
export function useSignOut(): () => Promise<void> {
  const [logout] = useLogoutMutation();
  const dispatch = useAppDispatch();

  return async () => {
    const refreshToken = await getRefreshToken();
    try {
      await logout(refreshToken ? { refreshToken } : undefined).unwrap();
    } catch {
      // Offline or expired: the local session ends all the same
    }
    await clearRefreshToken();
    dispatch(sessionEnded());
  };
}
