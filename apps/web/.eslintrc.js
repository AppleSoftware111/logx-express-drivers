/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['@logx/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
