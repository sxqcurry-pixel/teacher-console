/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: ['prettier'],
  ignorePatterns: [
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
    '.turbo',
    'pnpm-lock.yaml',
    'migrations',
  ],
  rules: {
    'no-unused-vars': 'off',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  },
};
