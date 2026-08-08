import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat config. Mirrors the broad rule selection of the Python harness's ruff setup.
export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      '.lighthouseci',
      'public/mockServiceWorker.js',
      // Dynamic workflows run inside Claude Code's own module wrapper, where a
      // top-level `return` and the injected `agent` / `pipeline` globals are legal.
      // ESLint parses them as plain ESM and rejects both. The runner owns this file's
      // semantics, not the linter.
      '.claude/workflows/**',
    ],
  },

  // Type-aware linting for application + test sources.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      // Explicit type checking (mirror mypy disallow_untyped_defs).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',

      // No stray debugging output in committed code (Definition of Done).
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Fractal dependency rule (eslint-plugin-boundaries). The single architectural
  // rule, machine-enforced: within a feature UI → services → repositories → core;
  // across features only via the public surface (index.ts); core/env depend on
  // nothing above. See docs/architecture.md §1.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      // Resolve TS extensions + the `@/*` alias so boundaries can classify imports.
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        // Order matters: most specific first. File-mode = exact file; folder-mode
        // (default) = the folder + everything inside it.
        {
          type: 'feature-index',
          mode: 'file',
          pattern: 'src/features/*/index.ts',
          capture: ['feature'],
        },
        { type: 'feature-ui', pattern: 'src/features/*/ui', capture: ['feature'] },
        { type: 'feature-service', pattern: 'src/features/*/services', capture: ['feature'] },
        { type: 'feature-repo', pattern: 'src/features/*/repositories', capture: ['feature'] },
        { type: 'env', mode: 'file', pattern: 'src/env.ts' },
        { type: 'core', pattern: 'src/core' },
        { type: 'shared-ui', pattern: 'src/components' },
        { type: 'app', mode: 'file', pattern: 'src/{App,main}.tsx' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            // App shell composes features via their public surface + the bottom layer
            // (and its own modules — main.tsx mounts App.tsx).
            {
              from: [{ type: 'app' }],
              allow: [
                { to: { type: 'app' } },
                { to: { type: 'core' } },
                { to: { type: 'env' } },
                { to: { type: 'shared-ui' } },
                { to: { type: 'feature-index' } },
              ],
            },
            // Design-system primitives lean only on the bottom layer and each other.
            {
              from: [{ type: 'shared-ui' }],
              allow: [
                { to: { type: 'core' } },
                { to: { type: 'env' } },
                { to: { type: 'shared-ui' } },
              ],
            },
            // core / env sit at the bottom — they depend on nothing above.
            {
              from: [{ type: 'core' }],
              allow: [{ to: { type: 'core' } }, { to: { type: 'env' } }],
            },
            { from: [{ type: 'env' }], allow: [{ to: { type: 'env' } }] },
            // Within a feature, the one-directional rule holds.
            {
              from: [{ type: 'feature-ui' }],
              allow: [
                { to: { type: 'core' } },
                { to: { type: 'env' } },
                { to: { type: 'shared-ui' } },
                {
                  to: {
                    type: 'feature-service',
                    captured: { feature: '{{from.captured.feature}}' },
                  },
                },
                // Other features only through their published surface.
                {
                  to: {
                    type: 'feature-index',
                    captured: { feature: '!{{from.captured.feature}}' },
                  },
                },
              ],
            },
            {
              from: [{ type: 'feature-service' }],
              allow: [
                { to: { type: 'core' } },
                { to: { type: 'env' } },
                {
                  to: { type: 'feature-repo', captured: { feature: '{{from.captured.feature}}' } },
                },
                {
                  to: {
                    type: 'feature-index',
                    captured: { feature: '!{{from.captured.feature}}' },
                  },
                },
              ],
            },
            // Repositories touch only the bottom layer (no React, no services).
            {
              from: [{ type: 'feature-repo' }],
              allow: [{ to: { type: 'core' } }, { to: { type: 'env' } }],
            },
            // The public surface re-exports its own feature's internals.
            {
              from: [{ type: 'feature-index' }],
              allow: [
                { to: { type: 'core' } },
                { to: { type: 'env' } },
                { to: { type: 'feature-ui', captured: { feature: '{{from.captured.feature}}' } } },
                {
                  to: {
                    type: 'feature-service',
                    captured: { feature: '{{from.captured.feature}}' },
                  },
                },
                {
                  to: { type: 'feature-repo', captured: { feature: '{{from.captured.feature}}' } },
                },
              ],
            },
          ],
        },
      ],
    },
  },

  // Tests may be looser about a few rules.
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // Config files run in Node and are not part of the app tsconfig type graph.
  {
    files: ['*.config.{js,ts}', 'vitest.setup.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
