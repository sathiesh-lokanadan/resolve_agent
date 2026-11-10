import { useCallback, useSyncExternalStore } from "react";

const KEY = "resolve.apiKey";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The API key lives in sessionStorage only: it is gone when the tab closes. */
export function useApiKey() {
  const key = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    read,
    () => "",
  );
  const setKey = useCallback((value: string) => {
    try {
      if (value) sessionStorage.setItem(KEY, value);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((l) => l());
  }, []);
  return [key, setKey] as const;
}
