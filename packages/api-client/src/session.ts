/** What the app provides so that the shared client can authenticate requests and refresh the session. */
export interface SessionAdapter {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  /**
   * Clients without cookies (mobile) keep the refresh token in secure storage and send it in the body.
   * Web leaves these out: its refresh token is an httpOnly cookie the browser sends on its own.
   */
  getRefreshToken?(): string | null | Promise<string | null>;
  setRefreshToken?(token: string): void | Promise<void>;
  /** The refresh failed, so the user has to sign in again. */
  onSessionExpired(): void;
}
