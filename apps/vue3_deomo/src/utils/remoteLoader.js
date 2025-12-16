import { defineAsyncComponent } from 'vue'

export function loadRemoteVueComponent(url) {
  // Vite：从 URL 动态 import 需要 @vite-ignore
  return defineAsyncComponent(async () => {
    const mod = await import(/* @vite-ignore */ url)
    return mod.default || mod
  })
}
