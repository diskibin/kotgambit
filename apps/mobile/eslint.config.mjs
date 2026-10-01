import base from '@kotgambit/config/eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  { ignores: ['android/**', 'ios/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.jest },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Metro, Babel and Jest configs are CommonJS by React Native convention
    files: ['*.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
