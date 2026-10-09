// The hosts of the first payment page: from the example answer of the YooKassa reference
// (confirmation_url on yoomoney.ru) and the address of the payment form of Robokassa (auth.robokassa.ru). The pages after it, such as the bank's 3-D Secure page, are on
// hosts nobody can list, so only the first load is held to this list (PLAN.md 6.8).
const PAYMENT_HOSTS = ['yookassa.ru', 'yoomoney.ru', 'robokassa.ru'] as const;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Whether the page the app is asked to open for a payment is a payment page of the provider, over https. */
export function isPaymentPageUrl(url: string): boolean {
  const parsed = parse(url);
  if (!parsed || parsed.protocol !== 'https:') return false;
  return PAYMENT_HOSTS.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
  );
}

/** Whether the learner has been sent back to our page for this payment. */
export function isReturnUrl(url: string, returnUrl: string): boolean {
  const target = parse(returnUrl);
  const parsed = parse(url);
  if (!target || !parsed) return false;
  return (
    parsed.origin === target.origin &&
    parsed.pathname === target.pathname &&
    parsed.searchParams.get('paymentId') === target.searchParams.get('paymentId')
  );
}

export type Navigation =
  /** The learner is back: close the page and ask the server. */
  | { kind: 'return' }
  /** A page in the WebView, which stays in it. */
  | { kind: 'load' }
  /** Something that must not be opened at all: a page without https, or an inline document. */
  | { kind: 'block' }
  /** An address the WebView cannot open, such as a banking app: hand it to the system, with a fallback page. */
  | { kind: 'external'; url: string; fallback: string | null };

/**
 * What to do with an address the WebView is about to open. Banks and the SBP send the learner to their
 * apps through `intent://` and custom schemes, which a WebView cannot show.
 */
export function classifyNavigation(url: string, returnUrl: string): Navigation {
  if (isReturnUrl(url, returnUrl)) return { kind: 'return' };
  if (url.startsWith('https://')) return { kind: 'load' };
  if (url.startsWith('intent://')) {
    const intent = parseIntentUrl(url);
    if (intent) return { kind: 'external', url: intent.url, fallback: intent.fallback };
  }
  if (url.startsWith('about:')) return { kind: 'load' };
  // The card is entered on pages over https only, and nothing inline or from the disk belongs in a payment
  if (/^(http|data|file|javascript|blob):/i.test(url)) return { kind: 'block' };
  return { kind: 'external', url, fallback: null };
}

/**
 * Turns an Android `intent://host/path#Intent;scheme=sberpay;package=...;S.browser_fallback_url=...;end` into
 * the address to open, `sberpay://host/path`, and the page to show if no app answers.
 */
export function parseIntentUrl(url: string): { url: string; fallback: string | null } | null {
  const hash = url.indexOf('#Intent;');
  if (!url.startsWith('intent://') || hash === -1) return null;
  const target = url.slice('intent:'.length, hash);
  const parts = url.slice(hash + '#Intent;'.length).split(';');
  const extras = new Map<string, string>();
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq > 0) extras.set(part.slice(0, eq), part.slice(eq + 1));
  }
  const scheme = extras.get('scheme');
  if (!scheme) return null;
  const fallback = extras.get('S.browser_fallback_url');
  return {
    url: `${scheme}:${target}`,
    fallback: fallback ? decodeURIComponent(fallback) : null,
  };
}
