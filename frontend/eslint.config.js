import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Standalone learning sketch, not part of the application.
  { ignores: ['dist', 'coverage', 'src/test_app.tsx'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        DOMException: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
      },
    },
  },
)

