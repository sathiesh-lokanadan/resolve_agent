/**
 * Embeds every article in lib/data/articles.json and upserts it into Supabase.
 * Run:  npm run seed:kb     (reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local)
 * Articles removed from the JSON file are deleted from the table.
 */
import { articles } from "../lib/data";
import { embed } from "../lib/kb";

const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for example in .env.local).");
  process.exit(1);
}
const headers = { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" };

async function main() {
  // One chunk per article: the articles are short, so title, tags and body embed together.
  const vectors = await embed(articles.map((a) => `${a.title}\n${a.tags.join(", ")}\n${a.body}`));
  const rows = articles.map((a, i) => ({ ...a, embedding: JSON.stringify(vectors[i]) }));

  const up = await fetch(`${url}/rest/v1/kb_articles?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
  if (!up.ok) throw new Error(`Upsert failed (HTTP ${up.status}): ${await up.text()}`);

  const ids = articles.map((a) => `"${a.id}"`).join(",");
  const del = await fetch(`${url}/rest/v1/kb_articles?id=not.in.(${ids})`, { method: "DELETE", headers });
  if (!del.ok) throw new Error(`Cleanup failed (HTTP ${del.status}): ${await del.text()}`);
  console.log(`Seeded ${rows.length} articles.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
