import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        storage: 'readonly',
        habits: 'readonly',
        auth: 'readonly',
        db: 'readonly',
      },
    },
  },

  {
    files: ['electron/**/*.js', 'electron/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node, 
      },
    },
  },

  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'no-var': 'error',
    },
  },
  
  { ignores: ['dist/**', 'release/**', 'node_modules/**', 'vite.config.js', 'vitest.config.js'] }
];