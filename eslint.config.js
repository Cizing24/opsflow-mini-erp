import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
export default ts.config({ ignores: ['**/dist/**', '**/generated/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', '.impeccable/**'] }, js.configs.recommended, ...ts.configs.recommended, ...vue.configs['flat/recommended'], { files: ['**/*.{js,mjs,ts,vue}'], languageOptions: { globals: {...globals.node,...globals.browser}, parserOptions: { parser: ts.parser } }, rules: { '@typescript-eslint/no-explicit-any': 'error', 'vue/multi-word-component-names': 'off', 'vue/max-attributes-per-line': 'off', 'vue/html-self-closing': 'off', 'vue/singleline-html-element-content-newline': 'off', 'vue/html-indent': 'off', 'vue/html-closing-bracket-newline': 'off', 'vue/attributes-order': 'off' } });

