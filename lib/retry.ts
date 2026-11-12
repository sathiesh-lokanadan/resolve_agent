/** Retry with exponential backoff. Used for provider and knowledge-base calls. */
export interface RetryOptions {
  /** Total attempts, including the first. */
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  /** Return true if this failure is worth another try. Optionally return a wait in ms (for example from Retry-After). */
  shouldRetry: (err: unknown, attempt: number) => boolean | number;
  signal?: AbortSignal;
  /** Injected in tests so they do not really wait. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  onRetry?: (info: { attempt: number; waitMs: number; error: unknown }) => void;
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, o: RetryOptions): Promise<T> {
  const attempts = o.attempts ?? 3;
  const baseMs = o.baseMs ?? 500;
  const maxMs = o.maxMs ?? 8000;
  const wait = o.sleep ?? sleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (o.signal?.aborted) throw error;
      const verdict = attempt < attempts ? o.shouldRetry(error, attempt) : false;
      if (!verdict) throw error;
      const hinted = typeof verdict === "number" ? verdict : 0;
      const waitMs = Math.min(maxMs, Math.max(hinted, baseMs * 2 ** (attempt - 1)));
      o.onRetry?.({ attempt, waitMs, error });
      await wait(waitMs, o.signal);
    }
  }
}

/** HTTP statuses that are temporary: rate limit, timeout, server errors. */
export const isTransientStatus = (status?: number) =>
  status !== undefined && (status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || status === 529);
