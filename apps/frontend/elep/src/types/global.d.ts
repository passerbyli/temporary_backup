export {}

declare global {
  interface Window {
    electron: {
      onNavigate: (callback: (route: string) => void) => void
    }
  }
}
