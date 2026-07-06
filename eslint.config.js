const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**', 'public/uploads/**', 'logs/**', 'dist/**'],
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',

      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },

    rules: {
      // Possible Problems
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

      eqeqeq: ['error', 'always'],

      curly: ['error', 'all'],

      semi: ['error', 'always'],

      quotes: ['error', 'single'],

      indent: ['error', 2],

      'comma-dangle': ['error', 'always-multiline'],

      'object-curly-spacing': ['error', 'always'],

      'array-bracket-spacing': ['error', 'never'],

      'arrow-spacing': ['error'],

      'keyword-spacing': ['error'],

      'space-before-blocks': ['error'],

      'space-infix-ops': ['error'],

      'eol-last': ['error', 'always'],
    },
  },
];
