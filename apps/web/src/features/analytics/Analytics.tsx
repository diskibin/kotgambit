import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useAppSelector } from '../../app/hooks';
import { useTrack } from './useTrack';

const ADMIN_PATH = '/admin';
const PREMIUM_PATH = '/premium';

/** Counts the visit, the sign-in and the look at the premium page, once each per browser session. */
export function Analytics() {
  const track = useTrack();
  const { pathname } = useLocation();
  const status = useAppSelector((state) => state.auth.status);
  // The owner looking at the numbers is not a visitor
  const counted = !pathname.startsWith(ADMIN_PATH);

  useEffect(() => {
    if (counted) track('visit', { oncePerSession: true });
  }, [counted, track]);

  useEffect(() => {
    if (counted && status === 'authenticated') track('signed_in', { oncePerSession: true });
  }, [counted, status, track]);

  useEffect(() => {
    if (pathname === PREMIUM_PATH) track('premium_view', { oncePerSession: true });
  }, [pathname, track]);

  return null;
}
