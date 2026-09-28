import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'desktop/**'] },
  js.configs.recommended,
  {files:['tools/**/*.mjs'],languageOptions:{globals:globals.node}},
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      // The imported AI Studio prototype contains placeholder controls that are
      // intentionally unused. Re-enable this rule after those screens are rebuilt.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
