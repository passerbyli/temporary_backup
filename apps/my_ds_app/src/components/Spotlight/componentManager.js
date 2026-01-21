/**
 * 组件管理器：负责管理 Spotlight 搜索结果的动态组件加载
 */

// 导入组件
import IpInfoComponent from './IpInfoComponent.vue';

// 组件注册表
const componentRegistry = [
  {
    // IP 信息组件
    name: 'IpInfoComponent',
    component: IpInfoComponent,
    // 匹配规则：返回 true 表示匹配
    match: (query) => {
      const lowerQuery = query.toLowerCase().trim();
      return lowerQuery.includes('ip') || 
             lowerQuery.includes('ip信息') || 
             lowerQuery.includes('ip地址') || 
             lowerQuery.includes('mac');
    },
    // 组件配置
    config: {
      height: 100, // 组件高度，用于计算窗口大小
      priority: 10 // 优先级，越高越先匹配
    }
  },
  // 这里可以添加其他组件
  // {
  //   name: 'CalculatorComponent',
  //   component: CalculatorComponent,
  //   match: (query) => /^[\d+\-*/().]+$/.test(query),
  //   config: {
  //     height: 150,
  //     priority: 20
  //   }
  // },
  // {
  //   name: 'CurrencyConverterComponent',
  //   component: CurrencyConverterComponent,
  //   match: (query) => query.includes('汇率') || query.includes('兑换'),
  //   config: {
  //     height: 120,
  //     priority: 15
  //   }
  // }
];

/**
 * 查找匹配的组件
 * @param {string} query 用户输入的查询字符串
 * @returns {Object|null} 匹配的组件信息，包含 component 和 config，或者 null
 */
export function findMatchingComponent(query) {
  const matches = componentRegistry
    .filter(entry => entry.match(query))
    .sort((a, b) => b.config.priority - a.config.priority);
  
  return matches.length > 0 ? matches[0] : null;
}

/**
 * 获取所有组件信息
 * @returns {Array} 所有注册的组件信息
 */
export function getAllComponents() {
  return componentRegistry;
}

/**
 * 注册新组件
 * @param {Object} componentInfo 组件信息
 * @param {string} componentInfo.name 组件名称
 * @param {VueComponent} componentInfo.component Vue 组件
 * @param {Function} componentInfo.match 匹配函数
 * @param {Object} componentInfo.config 组件配置
 */
export function registerComponent(componentInfo) {
  // 检查是否已存在同名组件
  const existingIndex = componentRegistry.findIndex(entry => entry.name === componentInfo.name);
  if (existingIndex !== -1) {
    componentRegistry[existingIndex] = componentInfo;
  } else {
    componentRegistry.push(componentInfo);
  }
}

/**
 * 卸载组件
 * @param {string} componentName 组件名称
 */
export function unregisterComponent(componentName) {
  const index = componentRegistry.findIndex(entry => entry.name === componentName);
  if (index !== -1) {
    componentRegistry.splice(index, 1);
  }
}

/**
 * 清空所有组件
 */
export function clearComponents() {
  componentRegistry.length = 0;
}
