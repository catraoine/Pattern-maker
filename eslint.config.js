// The code checker: catches mistakes the type check can't (a hook used out of order, a missing dependency, code
// that can't run). `npm run lint` runs it; the tests workflow runs it on every pull request.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'playwright-report', 'test-results', 'public', '.claude'] },
  {
    files: ['**/*.{ts,tsx,mts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The type check already reports unused names (noUnusedLocals), with the same rules.
      '@typescript-eslint/no-unused-vars': 'off',
      // `let { segs, tags } = …` where only one is reassigned stays one line.
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
);
