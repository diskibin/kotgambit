import base from '@kotgambit/config/eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
];
