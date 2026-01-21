export {};

declare global {
  interface Window {
    electronAPI: {
      onNavigate: (callback: (route: string) => void) => void;
    };
    logger: void;
  }
}
