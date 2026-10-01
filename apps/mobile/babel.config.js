module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // zod ships `export * as ns from`, which the React Native preset leaves alone
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
