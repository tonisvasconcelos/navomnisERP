const path = require('node:path');

module.exports = {
  root: true,
  extends: [path.join(__dirname, '../../packages/config/eslint/react.cjs')],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  ignorePatterns: ['dist', 'node_modules'],
};
