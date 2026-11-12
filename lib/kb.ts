import { log } from "./log";
import { isTransientStatus, withRetry } from "./retry";

/**
 * Retrieval for search_kb: embed the query with gte-small (Supabase Edge Function),
 * then ask Postgres/pgvector for the closest articles by cosine similarity.
 */
export const EMBED_MODEL = "gte-small";
export const KB_SOURCE = "supabase pgvector: kb_articles";
export const KB_METHOD = `vector similarity (${EMBED_MODEL}, cosine)`;

export class KbError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}

/**
 * Circuit breaker. After 3 failed searches in a row the knowledge base is treated as down for 30 s,
 * so the agent answers (or escalates) straight away instead of waiting on a dead service every time.
 */
export const BREAKER = { threshold: 3, coolDownMs: 30_000, failures: 0, openUntil: 0 };
export const resetBreaker = () => ((BREAKER.failures = 0), (BREAKER.openUntil = 0));

function config() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new KbError("The knowledge base is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing).");
  return { url, headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" } };
}

async function callOnce(path: string, init: RequestInit, what: string): Promise<Response> {
  const { url, headers } = config();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new KbError(`Could not reach Supabase for ${what}.`, true);
  }
  if (!res.ok) throw new KbError(`Supabase ${what} failed (HTTP ${res.status}).`, isTransientStatus(res.status));
  return res;
}

/** One Supabase call, retried once on a temporary failure. */
const call = (path: string, init: RequestInit, what: string) =>
  withRetry(() => callOnce(path, init, what), {
    attempts: 2,
    baseMs: 300,
    shouldRetry: (e) => e instanceof KbError && e.retryable,
    onRetry: ({ attempt }) => log("kb_retry", { attempt, what }, "warn"),
  });

/** One embedding (384 numbers) per input text. */
export async function embed(inputs: string[]): Promise<number[][]> {
  const res = await call("/functions/v1/embed", { method: "POST", body: JSON.stringify({ inputs }) }, "embedding");
  const { embeddings } = (await res.json()) as { embeddings?: number[][] };
  if (!Array.isArray(embeddings) || embeddings.length !== inputs.length) throw new KbError("The embedding service returned an unexpected answer.");
  return embeddings;
}

export interface KbMatch {
  id: string;
  title: string;
  similarity: number;
  text: string;
}

/** Top articles for a query. Ordered by similarity, highest first. */
export async function searchKb(query: string, limit = 3): Promise<KbMatch[]> {
  if (Date.now() < BREAKER.openUntil)
    throw new KbError("The knowledge base has been failing and is paused for a few seconds.");
  try {
    const matches = await searchKbOnce(query, limit);
    BREAKER.failures = 0;
    return matches;
  } catch (e) {
    // A missing configuration is not an outage, so it does not trip the breaker.
    if (e instanceof KbError && e.retryable && ++BREAKER.failures >= BREAKER.threshold) {
      BREAKER.openUntil = Date.now() + BREAKER.coolDownMs;
      log("kb_breaker_open", { failures: BREAKER.failures }, "error");
    }
    throw e;
  }
}

async function searchKbOnce(query: string, limit: number): Promise<KbMatch[]> {
  const [vector] = await embed([query]);
  const minSimilarity = Number(process.env.KB_MIN_SIMILARITY ?? 0);
  const res = await call(
    "/rest/v1/rpc/match_kb_articles",
    { method: "POST", body: JSON.stringify({ query_embedding: JSON.stringify(vector), match_count: limit, min_similarity: minSimilarity }) },
    "vector search",
  );
  const rows = (await res.json()) as { id: string; title: string; body: string; similarity: number }[];
  if (!Array.isArray(rows)) throw new KbError("The vector search returned an unexpected answer.");
  return rows.map((r) => ({ id: r.id, title: r.title, similarity: Math.round(r.similarity * 1000) / 1000, text: r.body }));
}
