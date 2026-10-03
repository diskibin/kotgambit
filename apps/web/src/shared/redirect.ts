/**
 * Leaves the app for another page, such as the payment page of the provider. A function of its own so that
 * tests can replace it: jsdom does not navigate.
 */
export function redirect(url: string): void {
  window.location.assign(url);
}
