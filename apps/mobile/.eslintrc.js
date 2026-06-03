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
    'import/no-named-as-default-member': 'warn',
    'import/no-unresolved': 'off',
    'import/namespace': 'off',
    'import/order': 'off',
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
};
