import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vuePlugin from 'eslint-plugin-vue';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import vueParser from 'vue-eslint-parser';

const ignores = ['**/node_modules/**', '**/dist/**', '**/build/**', '.**', 'scripts/**', '**/*.d.tsx'];

// 按需调整你的前后端目录（我按你之前的 apps 结构写了更常见的路径）
const frontendGlobs = ['apps/frontend/**/*.{js,ts,jsx,tsx,vue}', 'packages/components/**/*.{js,ts,jsx,tsx,vue}'];
const backendGlobs = ['apps/backend/**/*.{js,ts}'];

export default defineConfig([
  // 通用配置（JS/TS + Prettier）
  {
    ignores,
    files: ['**/*.{js,cjs,mjs,ts,tsx,jsx,vue}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
    },
    rules: {
      'no-var': 'error',
      'prettier/prettier': 'warn',
    },
  },

  // 前端（浏览器 + Vue + 允许 process 只读以兼容 process.env）
  {
    ignores,
    files: frontendGlobs,
    // Vue SFC 需要 vue-eslint-parser，并把 TS 解析器挂到 parserOptions.parser
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
        // 若前端代码里用到了 process.env，声明为只读即可避免 no-undef
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    plugins: {
      vue: vuePlugin,
    },
    extends: [...vuePlugin.configs['flat/recommended'], eslintConfigPrettier],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true, // 允许 a && b()
          allowTernary: true, // 允许 a ? b() : c()
          allowTaggedTemplates: true, // 允许标签模板
        },
      ],
      // 这里可以放你的 Vue 规则
    },
  },

  // 后端（Node 环境）
  {
    ignores,
    files: backendGlobs,
    languageOptions: {
      // Node 全局（包含 process、__dirname 等）
      globals: {
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // 这里可以加 Node 端特定规则
    },
  },
]);
