/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@logx/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
