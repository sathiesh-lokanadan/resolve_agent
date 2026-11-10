import { ProviderError } from "./types";

const TIMEOUT_MS = 100_000;

function messageOf(json: unknown): string | undefined {
  const err = (json as { error?: { message?: unknown } | string } | null)?.error;
  if (typeof err === "string") return err;
  return typeof err?.message === "string" ? err.message : undefined;
}

/** POST JSON and return the parsed answer. Failures become ProviderError with the HTTP status. */
export async function postJson(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
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
    throw new ProviderError(timeout.aborted ? "The provider took too long to answer." : "Could not reach the provider API.");
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) throw new ProviderError(messageOf(json) ?? `HTTP ${res.status}`, res.status);
  return json as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
