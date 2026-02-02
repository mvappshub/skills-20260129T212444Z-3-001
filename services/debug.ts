export type DebugLogger = (...args: unknown[]) => void;

export function createDebugLogger(enabled: boolean): DebugLogger {
  return (...args: unknown[]) => {
    if (enabled) {
      console.warn(...args);
    }
  };
}

const debugEnabled = import.meta.env.VITE_DEBUG_LOGS === 'true';
export const debugLog = createDebugLogger(debugEnabled);
