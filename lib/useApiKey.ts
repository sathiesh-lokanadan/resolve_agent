import { useCallback, useSyncExternalStore } from "react";
import type { Provider } from "./types";

const listeners = new Set<() => void>();
const storageKey = (provider: Provider) => `resolve.apiKey.${provider}`;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** One key per provider, kept in sessionStorage only: gone when the tab closes. */
export function useApiKey(provider: Provider) {
  const read = useCallback(() => {
    try {
      return sessionStorage.getItem(storageKey(provider)) ?? "";
    } catch {
      return "";
    }
  }, [provider]);
  const key = useSyncExternalStore(subscribe, read, () => "");

  const setKey = useCallback(
    (value: string) => {
      try {
        if (value) sessionStorage.setItem(storageKey(provider), value);
        else sessionStorage.removeItem(storageKey(provider));
      } catch {
        /* storage unavailable */
      }
      listeners.forEach((l) => l());
    },
    [provider],
  );
  return [key, setKey] as const;
}
