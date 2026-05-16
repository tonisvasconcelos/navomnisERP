const path = require('node:path');

module.exports = {
  root: true,
  extends: [path.join(__dirname, '../../packages/config/eslint/base.cjs')],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignorePatterns: ['dist', 'node_modules'],
};
