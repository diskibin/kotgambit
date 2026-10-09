const KEY = 'kotgambit.pendingCheckout';

interface PendingCheckout {
  paymentId: string;
  url: string;
}

// Kept so that the learner who left the payment page can go back to the same payment. Storage may be
// blocked, then the return page just offers a new try.
export function rememberCheckout(paymentId: string, url: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ paymentId, url } satisfies PendingCheckout));
  } catch {
    // nothing to do without storage
  }
}

export function rememberedCheckoutUrl(paymentId: string): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<PendingCheckout>) : null;
    return saved?.paymentId === paymentId && typeof saved.url === 'string' ? saved.url : null;
  } catch {
    return null;
  }
}
