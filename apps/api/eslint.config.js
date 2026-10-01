import base from '@kotgambit/config/eslint';

export default [
  ...base,
  {
    // Nest injects by the constructor parameter types that emitDecoratorMetadata reads at runtime,
    // so those imports must stay value imports
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
];
