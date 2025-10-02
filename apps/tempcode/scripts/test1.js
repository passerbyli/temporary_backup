/////

// read-components.js
import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'

/**
 * 读取 component 目录下各子文件夹的 JSON 配置
 * @param {string} componentDir 组件根目录（绝对或相对路径）
 * @returns {Promise<Array<Object>>}
 */
export async function readComponentConfigs(componentDir = './component') {
  // 1. 列出 component 下所有条目
  const entries = await readdir(componentDir, { withFileTypes: true })

  // 2. 仅保留目录
  const folders = entries.filter((e) => e.isDirectory())

  // 3. 并行读取每个目录里的 .json 文件
  const configs = await Promise.all(
    folders.map(async (dirEnt) => {
      const folderName = dirEnt.name
      const folderPath = path.join(componentDir, folderName)

      // 默认约定：json 文件名与文件夹同名（如 folder1/folder1.json）
      const jsonPath = path.join(folderPath, `${folderName}.json`)

      try {
        // 先确认文件存在再读取（可选）
        await stat(jsonPath)

        // 读取并解析 JSON
        const raw = await readFile(jsonPath, 'utf-8')
        const json = JSON.parse(raw)

        // 返回合并后的对象：folderName + json 所有字段
        return { folderName, ...json }
      } catch (err) {
        console.warn(`⚠️  跳过 ${jsonPath}：${err.message}`)
        return null // 若缺文件或解析失败则忽略
      }
    })
  )

  // 4. 过滤掉为空的项
  return configs.filter(Boolean)
}

// ◆ 示例调用
if (import.meta.url === `file://${process.argv[1]}`) {
  readComponentConfigs('./component')
    .then((res) => console.log(JSON.stringify(res, null, 2)))
    .catch(console.error)
}
