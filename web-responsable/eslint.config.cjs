// Le monorepo partage les outils ESLint/TypeScript installés dans mobile/.
const { createRequire } = require('node:module');
const path = require('node:path');
const depuisMobile = createRequire(path.resolve(__dirname, '../mobile/package.json'));

module.exports = [{
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: {
    parser: depuisMobile('@typescript-eslint/parser'),
    parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  },
  plugins: { '@typescript-eslint': depuisMobile('@typescript-eslint/eslint-plugin') },
  rules: {
    'constructor-super': 'error',
    'no-debugger': 'error',
    'no-duplicate-case': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    eqeqeq: ['error', 'smart'],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
  },
}];
