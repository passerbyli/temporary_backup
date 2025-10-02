declare global {
  interface Window {
    dsApi: {
      list: () => Promise<any>
      save: (data: any) => Promise<any>
      test: (ds: any) => Promise<any>
    }
  }
}

export async function listSources() {
  return await window.dsApi.list()
}

export async function saveSources(data: any) {
  return await window.dsApi.save(JSON.parse(JSON.stringify(data)))
}

export async function testSource(ds: any) {
  return await window.dsApi.test(JSON.parse(JSON.stringify(ds)))
}
