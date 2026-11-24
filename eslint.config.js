import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/', 'docker/localdev/']),
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Vue files are type checked by vue-tsc, so they get the rules that need no type information.
    files: ['**/*.vue'],
    extends: [tseslint.configs.strict, tseslint.configs.stylistic, vue.configs['flat/recommended']],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, sourceType: 'module' },
    },
    rules: {
      // vue-tsc reports undefined names; this rule does not know TypeScript (typescript-eslint turns it off
      // for .ts files the same way)
      'no-undef': 'off',
    },
  },
  {
    // The simulation must stay deterministic and independent of rendering, UI and the browser.
    files: ['packages/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'phaser/*', 'vue', 'vue/*', '@vue/*'],
              message: 'sim is pure game logic: no rendering or UI imports.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded PRNG in src/rng.ts.' },
        { object: 'Date', property: 'now', message: 'The simulation advances by ticks, not wall time.' },
        {
          object: 'performance',
          property: 'now',
          message: 'The simulation advances by ticks, not wall time.',
        },
      ],
    },
  },
  prettier,
);
