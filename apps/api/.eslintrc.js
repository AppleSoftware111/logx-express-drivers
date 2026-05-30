/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@logx/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    'import/no-named-as-default': 'warn',
    'import/order': 'off',
  },
};
