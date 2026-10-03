import './src/shared/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// The Keystore does not exist in Jest, a plain object stands in for it. Entries are kept by service, as in the
// real module, because the refresh token and the preferences live side by side.
jest.mock('react-native-keychain', () => {
  const stored = new Map();
  return {
    // Like the real module, which answers false when nothing is stored
    getGenericPassword: jest.fn(async ({ service } = {}) => stored.get(service) ?? false),
    setGenericPassword: jest.fn(async (username, password, { service } = {}) => {
      const entry = { username, password, service: service ?? 'test', storage: 'test' };
      stored.set(service, entry);
      return entry;
    }),
    resetGenericPassword: jest.fn(async ({ service } = {}) => {
      stored.delete(service);
      return true;
    }),
  };
});

// The WebView is native, a plain view stands in for it and keeps its props for the tests to call
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ reload: jest.fn() }));
    globalThis.__webview = props;
    return React.createElement(View, { testID: 'webview' });
  });
  return { __esModule: true, WebView, default: WebView };
});
