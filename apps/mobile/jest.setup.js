import './src/shared/i18n';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// The Keystore does not exist in Jest, a plain object stands in for it
jest.mock('react-native-keychain', () => {
  let stored = null;
  return {
    // Like the real module, which answers false when nothing is stored
    getGenericPassword: jest.fn(async () => stored ?? false),
    setGenericPassword: jest.fn(async (username, password) => {
      stored = { username, password, service: 'test', storage: 'test' };
      return stored;
    }),
    resetGenericPassword: jest.fn(async () => {
      stored = null;
      return true;
    }),
  };
});
