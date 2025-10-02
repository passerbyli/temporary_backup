declare global {
  interface Window {
    configApi: {
      getConfig: () => Promise<any>
      updateConfig: (data: any) => Promise<any>
      sysOpenDirectory: (data: any) => Promise<any>
      sysOpenchrome: (data: any) => Promise<any>
      sysReadLogs: (data: any) => Promise<any>
    }
  }
}
interface ConfigData {
  // Define the shape of your config data here
  // For example:
  // key: string;
  // value: any;
  [key: string]: any
}

export async function loadConfig() {
  return await window.configApi.getConfig()
}

export async function saveConfig(data: ConfigData): Promise<any> {
  // 自动结构化克隆安全转换
  const safeData: ConfigData = JSON.parse(JSON.stringify(data))
  return await window.configApi.updateConfig(safeData)
}

export async function sysOpenDirectory(data: ConfigData): Promise<any> {
  // 自动结构化克隆安全转换
  const safeData: ConfigData = JSON.parse(JSON.stringify(data))
  return await window.configApi.sysOpenDirectory(safeData)
}

export async function sysOpenchrome(data: ConfigData): Promise<any> {
  // 自动结构化克隆安全转换
  const safeData: ConfigData = JSON.parse(JSON.stringify(data))
  return await window.configApi.sysOpenchrome(safeData)
}

export async function sysReadLogs(data: ConfigData): Promise<any> {
  // 自动结构化克隆安全转换
  const safeData: ConfigData = JSON.parse(JSON.stringify(data))
  return await window.configApi.sysReadLogs(safeData)
}
