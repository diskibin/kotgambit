import type { FastifyReply } from 'fastify';
import type { Session } from './auth.service.js';

export const REFRESH_COOKIE = 'kg_refresh';
// The browser sends the cookie to the auth routes only
export const REFRESH_COOKIE_PATH = '/auth';

/** The web app keeps the refresh token in an httpOnly cookie, script on the page never sees it. */
export function setRefreshCookie(reply: FastifyReply, session: Session, secure: boolean): void {
  void reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: session.refreshExpiresAt,
  });
}
