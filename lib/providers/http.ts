import { log } from "../log";
import { isTransientStatus, withRetry } from "../retry";
import { ProviderError } from "./types";

const TIMEOUT_MS = 100_000;

function messageOf(json: unknown): string | undefined {
  const err = (json as { error?: { message?: unknown } | string } | null)?.error;
  if (typeof err === "string") return err;
  return typeof err?.message === "string" ? err.message : undefined;
}

/** Seconds or an HTTP date from a Retry-After header, as milliseconds (0 if absent or unusable). */
export function retryAfterMs(value: string | null): number {
  if (!value) return 0;
  const secs = Number(value);
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 8000) : 0;
}

/** POST JSON and return the parsed answer. Temporary failures (429, 5xx, dropped connection) are retried twice with backoff. */
export function postJson(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal, sleep?: (ms: number) => Promise<void>) {
  return withRetry(() => postJsonOnce(url, headers, body, signal), {
    attempts: 3,
    sleep,
    signal,
    shouldRetry: (err) => {
      if (!(err instanceof ProviderError) || !err.retryable) return false;
      return err.retryAfterMs || true;
    },
    onRetry: ({ attempt, waitMs, error }) =>
      log("provider_retry", { attempt, waitMs, status: (error as ProviderError).status }, "warn"),
  });
}

async function postJsonOnce(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    // A timeout is not retried (it already cost 100 s); a dropped connection is.
    throw new ProviderError(
      timeout.aborted ? "The provider took too long to answer." : "Could not reach the provider API.",
      undefined,
      { retryable: !timeout.aborted },
    );
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok)
    throw new ProviderError(messageOf(json) ?? `HTTP ${res.status}`, res.status, {
      retryable: isTransientStatus(res.status),
      retryAfterMs: retryAfterMs(res.headers.get("retry-after")),
    });
  if (json === null) throw new ProviderError("The provider returned a reply that is not valid JSON.", res.status);
  return json as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
