import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { parseOAuthDeepLink, type OAuthDeepLink } from './oauthDeepLink';

// The address that opened the app stays the same while the process lives, so a screen that is built again
// must not use the one-time code in it a second time
const usedCodes = new Set<string>();

/** Calls `onLink` for every address that brings the app back from the browser sign-in. */
export function useOAuthDeepLink(onLink: (link: OAuthDeepLink) => void | Promise<void>): void {
  const latest = useRef(onLink);
  useEffect(() => {
    latest.current = onLink;
  });

  useEffect(() => {
    const handle = (url: string) => {
      const link = parseOAuthDeepLink(url);
      if (!link) return;
      if (link.kind === 'code') {
        if (usedCodes.has(link.code)) return;
        usedCodes.add(link.code);
      }
      void latest.current(link);
    };
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    return () => subscription.remove();
  }, []);
}
