// eslint.config.js
'use strict';

const { defineConfig, globalIgnores } = require('eslint/config');
const js = require('@eslint/js');
const globals = require('globals');
const eslintConfigPrettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  // Global ignores — diterapkan ke seluruh config di bawahnya
  globalIgnores(['coverage/**', 'dist/**', 'build/**']),

  // Rule dasar bawaan ESLint
  js.configs.recommended,

  // Konfigurasi utama: seluruh source code Node.js (CommonJS)
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Dorong pemakaian logger (winston) alih-alih console.log langsung
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },

  // Override khusus file test (Jest)
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },

  // Matikan rule ESLint yang bentrok dengan Prettier — HARUS di posisi paling akhir
  eslintConfigPrettier,
]);
