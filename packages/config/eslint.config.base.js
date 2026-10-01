import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// `any` stays an error: CLAUDE.md allows it only with a justifying comment,
// which is expressed as an explicit eslint-disable with a reason.
export default tseslint.config(
  { ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
