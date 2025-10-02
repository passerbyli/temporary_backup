interface LoginParams {
  username: string
  password: string
  role: string
}

declare global {
  interface Window {
    authApi: {
      login(params: LoginParams): Promise<any>
      changeRole(params: { role: string }): Promise<any>
      logout(): Promise<any>
    }
  }
}

export async function login(username: string, password: string, role: string): Promise<any> {
  return await window.authApi.login({ username, password, role })
}

export async function changeRole(role: string): Promise<any> {
  return await window.authApi.changeRole({ role })
}

export async function logout() {
  return await window.authApi.logout()
}
