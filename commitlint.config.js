/** @type {import('cz-git').UserConfig} */

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // @see: http://commitlint.js.org/#/reference-rules
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [1, 'always'],
    'header-max-length': [2, 'always', 108],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'subject-case': [0],
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复bug
        'docs', // 文档
        'style', // 样式
        'refactor', // 重构
        'test', // 测试
        'chore', // 构建过程或辅助工具的变动
        'revert',
        'ci',
        'chore',
        'wip',
        'workflow',
        'types',
        'release',
      ],
    ],
  },
  prompt: {
    types: [
      {
        value: 'feat',
        name: '新功能: ✨ 新增功能',
        emoji: ':sparkles:',
      },
      {
        value: 'fix',
        name: '修复: 🐛 修复缺陷',
        emoji: ':bug:',
      },
      {
        value: 'docs',
        name: 'docs: 📚 更新文档',
        emoji: ':books:',
      },
      {
        value: 'refactor',
        name: 'refactor: 🔨 代码重构（不新增功能也不修复bug）',
        emoji: ':hammer:',
      },
      {
        value: 'perf',
        name: 'perf: ⚡ 性能优化',
        emoji: ':zap:',
      },
      {
        value: 'style',
        name: '样式: 💄 代码格式（不影响功能，例如空格、分号等格式修正）',
        emoji: ':lipstick:',
      },
      {
        value: 'test',
        name: '测试: ✅ 添加、修改测试用例',
        emoji: ':white_check_mark:',
      },
      {
        value: 'chore',
        name: '构建过程或辅助工具的变动: 🔧 构建过程或辅助工具的变动',
        emoji: ':wrench:',
      },
      {
        value: 'revert',
        name: '回滚: ⏪ 回滚到上一个版本',
        emoji: ':rewind:',
      },
      {
        value: 'ci',
        name: 'CI: 🤖 CI/CD 相关更改',
        emoji: ':robot:',
      },
      {
        value: 'wip',
        name: '工作进行中: 🚧 工作进行中',
        emoji: ':construction:',
      },
      {
        value: 'workflow',
        name: '工作流: 🔄 工作流相关更改',
        emoji: ':repeat:',
      },
      {
        value: 'types',
        name: '类型: 🏷️ 类型定义相关更改',
        emoji: ':label:',
      },
      {
        value: 'release',
        name: '发布: 🚀 发布新版本',
        emoji: ':rocket:',
      },
    ],
    scopes: [{ name: 'components' }, { name: 'utils' }, { name: 'backend' }, { name: 'frontend' }, { name: 'root' }],
    allowCustomScopes: true,
    skipQuestions: ['breaking'],
    messages: {
      type: '选择 Commit 类型:',
      scope: '选择 Commit Scope:',
      customScope: '请输入 Commit Scope:',
      subject: '请输入 Commit 描述:',
      body: '请输入 Commit 详细描述:',
      footer: '请输入 Commit 底部信息:',
      confirmCommit: '确认使用以上信息提交？(y/n)',
    },
  },
};
