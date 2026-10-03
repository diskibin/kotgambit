import {
  classifyNavigation,
  isPaymentPageUrl,
  isReturnUrl,
  parseIntentUrl,
} from '../src/features/premium/paymentUrls';

const RETURN = 'https://kotgambit.example/billing/return?paymentId=abc&client=mobile';

describe('isPaymentPageUrl', () => {
  it('accepts the payment pages of the provider over https', () => {
    expect(isPaymentPageUrl('https://yoomoney.ru/api-pages/v2/payment-confirm/epl?orderId=1')).toBe(
      true,
    );
    expect(isPaymentPageUrl('https://pay.yookassa.ru/x')).toBe(true);
  });

  it('refuses other hosts, look-alikes and anything but https', () => {
    expect(isPaymentPageUrl('https://evil.example/yoomoney.ru')).toBe(false);
    expect(isPaymentPageUrl('https://notyoomoney.ru/pay')).toBe(false);
    expect(isPaymentPageUrl('https://yoomoney.ru.evil.example/pay')).toBe(false);
    expect(isPaymentPageUrl('http://yoomoney.ru/pay')).toBe(false);
    expect(isPaymentPageUrl('not a url')).toBe(false);
  });
});

describe('isReturnUrl', () => {
  it('knows our return page for this payment, whatever else is in the address', () => {
    expect(isReturnUrl(RETURN, RETURN)).toBe(true);
    expect(
      isReturnUrl('https://kotgambit.example/billing/return?paymentId=abc&extra=1', RETURN),
    ).toBe(true);
  });

  it('does not take another payment, another page or another site for it', () => {
    expect(isReturnUrl('https://kotgambit.example/billing/return?paymentId=other', RETURN)).toBe(
      false,
    );
    expect(isReturnUrl('https://kotgambit.example/premium?paymentId=abc', RETURN)).toBe(false);
    expect(isReturnUrl('https://evil.example/billing/return?paymentId=abc', RETURN)).toBe(false);
  });
});

describe('parseIntentUrl', () => {
  it('turns an intent into the address of the app and the page to fall back to', () => {
    const intent =
      'intent://qr.nspk.ru/AS1?type=01#Intent;scheme=bank100000000111;package=ru.example.bank;S.browser_fallback_url=https%3A%2F%2Fbank.example%2Fpay;end';
    expect(parseIntentUrl(intent)).toEqual({
      url: 'bank100000000111://qr.nspk.ru/AS1?type=01',
      fallback: 'https://bank.example/pay',
    });
  });

  it('works without a fallback and refuses what is not an intent', () => {
    expect(parseIntentUrl('intent://pay/now#Intent;scheme=sberpay;end')).toEqual({
      url: 'sberpay://pay/now',
      fallback: null,
    });
    expect(parseIntentUrl('intent://pay/now')).toBeNull();
    expect(parseIntentUrl('intent://pay#Intent;package=x;end')).toBeNull();
    expect(parseIntentUrl('https://example.com')).toBeNull();
  });
});

describe('classifyNavigation', () => {
  it('closes the page when the learner is sent back', () => {
    expect(classifyNavigation(RETURN, RETURN)).toEqual({ kind: 'return' });
  });

  it('keeps https pages in the WebView, 3-D Secure pages of banks too', () => {
    expect(classifyNavigation('https://acs.bank.example/3ds', RETURN)).toEqual({ kind: 'load' });
    expect(classifyNavigation('about:blank', RETURN)).toEqual({ kind: 'load' });
  });

  it('hands the apps of banks to the system', () => {
    expect(classifyNavigation('sberpay://pay?id=1', RETURN)).toEqual({
      kind: 'external',
      url: 'sberpay://pay?id=1',
      fallback: null,
    });
    expect(classifyNavigation('intent://pay#Intent;scheme=sberpay;end', RETURN)).toEqual({
      kind: 'external',
      url: 'sberpay://pay',
      fallback: null,
    });
  });

  it('blocks what must not open in a payment', () => {
    for (const url of [
      'http://example.com',
      'data:text/html,hi',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'blob:x',
    ]) {
      expect(classifyNavigation(url, RETURN)).toEqual({ kind: 'block' });
    }
  });
});
