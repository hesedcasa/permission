import {includeIgnoreFile} from '@eslint/compat'
import oclif from 'eslint-config-oclif'
import prettier from 'eslint-config-prettier'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import tseslint from 'typescript-eslint'

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore')

const config = [
  includeIgnoreFile(gitignorePath),
  {
    ignores: ['coverage/', 'dist/'],
  },
  ...oclif,
  // Disable type-checked (type-aware) rules for test files. Test fixtures and
  // mocks don't need full type information and shouldn't fail type-aware rules
  // such as no-unsafe-* / no-base-to-string. Mirrors plugin-lib#63.
  {
    files: ['test/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Relax overly-strict rules from eslint-config-oclif@7 across the project.
  {
    rules: {
      '@typescript-eslint/no-restricted-types': 'off',
    },
  },
  {
    files: ['src/commands/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      'perfectionist/sort-classes': 'off',
      'require-unicode-regexp': 'off',
      // `matchesPattern` is part of the package's public API (src/index.ts);
      // renaming it to satisfy the boolean-name prefix list would be breaking.
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/consistent-class-member-order': 'off',
      'unicorn/no-computed-property-existence-check': 'off',
    },
  },
  // Additional relaxations for test files only. These are pure style rules
  // that conflict with common test patterns (mock stubs, mock-tracking
  // booleans, the documented bare `eslint-disable max-params` convention).
  {
    files: ['test/**/*.ts'],
    rules: {
      '@eslint-community/eslint-comments/require-description': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/no-computed-property-existence-check': 'off',
      'unicorn/no-non-function-verb-prefix': 'off',
      'unicorn/prefer-https': 'off',
      // Iterator helpers (Iterator#toArray) aren't in the es2022 lib this
      // project targets, so spreading into an array stays the portable form.
      'unicorn/prefer-iterator-to-array': 'off',
    },
  },
  prettier,
]

export default config
