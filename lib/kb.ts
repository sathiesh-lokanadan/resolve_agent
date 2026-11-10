/**
 * Retrieval for search_kb: embed the query with gte-small (Supabase Edge Function),
 * then ask Postgres/pgvector for the closest articles by cosine similarity.
 */
export const EMBED_MODEL = "gte-small";
export const KB_SOURCE = "supabase pgvector: kb_articles";
export const KB_METHOD = `vector similarity (${EMBED_MODEL}, cosine)`;

export class KbError extends Error {}

function config() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new KbError("The knowledge base is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing).");
  return { url, headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" } };
}

async function call(path: string, init: RequestInit, what: string): Promise<Response> {
  const { url, headers } = config();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new KbError(`Could not reach Supabase for ${what}.`);
  }
  if (!res.ok) throw new KbError(`Supabase ${what} failed (HTTP ${res.status}).`);
  return res;
}

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
  const [vector] = await embed([query]);
  const minSimilarity = Number(process.env.KB_MIN_SIMILARITY ?? 0);
  const res = await call(
    "/rest/v1/rpc/match_kb_articles",
    { method: "POST", body: JSON.stringify({ query_embedding: JSON.stringify(vector), match_count: limit, min_similarity: minSimilarity }) },
    "vector search",
  );
  const rows = (await res.json()) as { id: string; title: string; body: string; similarity: number }[];
  return rows.map((r) => ({ id: r.id, title: r.title, similarity: Math.round(r.similarity * 1000) / 1000, text: r.body }));
}
