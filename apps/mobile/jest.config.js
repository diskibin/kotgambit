module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // The screens draw many board squares and the files run side by side: on a CI runner 5 s is too tight
  testTimeout: 20_000,
  // Redux Toolkit and its dependencies ship ES modules for the "react-native" resolver condition,
  // which Jest cannot run untransformed
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|redux|redux-thunk|reselect|react-redux)/)',
  ],
};
