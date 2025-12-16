import { defineAsyncComponent } from 'vue'

// 收集全部组件：/src/components/**/**.vue
const modules = import.meta.glob('@/components/**/*.vue')

export function loadBizComponent(componentName) {
  const key = `/src/components/${componentName}/${componentName}.vue`
  const loader = modules[key]

  if (!loader) {
    return {
      template: `<div style="padding:12px;color:#c00;">
        未找到组件：{{key}}
      </div>`,
      data() {
        return { key }
      },
    }
  }

  return defineAsyncComponent(loader)
}
