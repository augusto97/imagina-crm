import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'vendor/**', '*.config.js', '*.config.ts'],
    },
    js.configs.recommended,
    {
        files: ['app/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
            globals: {
                // Browser APIs: fetch, setTimeout, AbortController,
                // URLSearchParams, HTMLElement subclases, etc.
                ...globals.browser,
                // Tipos namespaces (no runtime, sólo TS types — ESLint
                // los ve como undefined porque no hace type-checking).
                JSX: 'readonly',
                React: 'readonly',
                // Tipos del fetch API que algunos browsers/lib.dom.d.ts
                // exponen pero no están en globals.browser.
                BodyInit: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/consistent-type-imports': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    prettier,
];
