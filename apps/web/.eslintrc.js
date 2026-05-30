/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals', '@logx/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
  },
};
