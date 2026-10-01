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
  {
    // Copied verbatim from the design package, which ships it as CommonJS
    files: ['*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
