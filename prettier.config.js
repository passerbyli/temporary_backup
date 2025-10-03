export default {
  // 指定最大换行长度
  printWidth: 120,
  // 缩进制表符宽度｜空格数
  tabWidth: 2,
  // 使用制表符而不是空格缩进行（true：使用制表符；false：使用空格）
  useTabs: false,
  // 语句末尾是否添加分号（true：添加分号；false：不添加分号）
  semi: true,
  // 单引号（true：使用单引号；false：使用双引号）
  singleQuote: true,
  //  对象属性是否添加引号（'as-needed'：仅在需要时添加引号；'consistent'：如果一个属性需要引号，则所有属性都需要引号；'preserve'：保持输入时的样式）
  quoteProps: 'as-needed',
  // JSX中使用单引号（true：使用单引号；false：使用双引号）
  jsxSingleQuote: false,
  // 多行时尽可能打印尾随逗号（'es5'：在ES5中有效的地方打印尾随逗号；'none'：不打印尾随逗号；'all'：在所有可能的地方打印尾随逗号）
  trailingComma: 'all',
  // 对象字面量的大括号内是否添加空格（true：添加空格；false：不添加空格）
  bracketSpacing: true,
  // 多行HTML、JSX、Vue等标签的闭合标签是否另起一行（true：另起一行；false：不另起一行）
  bracketSameLine: false,
  // 箭头函数参数是否添加括号（'always'：总是添加括号；'avoid'：避免添加括号）
  arrowParens: 'always',
  // 指定要使用的解析器，不需要写文件开头的 @prettier 标记
  requirePragma: false,
  // 可以在文件顶部插入特殊标记，指定该文件已使用 Prettier 格式化
  insertPragma: false,
  // Vue文件中的<script>和<style>标签是否缩进（true：缩进；false：不缩进）
  vueIndentScriptAndStyle: false,
  // 用于控制文本是否应该被换行以及如何进行换行（'always'：总是换行；'never'：从不换行；'preserve'：保留原样）
  proseWrap: 'preserve',
  // 在html中空格是否是敏感的 “css”- 遵守CSS显示数学的默认值；"strict"- 空格敏感；"ignore"- 空格不敏感
  htmlWhitespaceSensitivity: 'css',
  // 换行符（'lf'：换行；'crlf'：回车换行；'cr'：回车；'auto'：保持现有的换行符）
  endOfLine: 'lf',
  // 是否格式化嵌入的代码（'auto'：自动决定；'off'：不格式化；'on'：格式化）
  embeddedLanguageFormatting: 'auto',
  plugins: [],
  overrides: [],
  // 格式化的范围结束位置（Infinity：到文件结束；0：从文件开始）
  rangeEnd: Infinity,
  // 格式化的范围开始位置（0：从文件开始；Infinity：到文件结束）
  rangeStart: 0,
};
