import { articles } from "./data";

const STOP = new Set(["the", "and", "for", "how", "can", "does", "what", "with", "your", "you", "are", "our", "this", "that", "from", "have", "about", "need", "want"]);

const stem = (w: string) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const words = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);

/** Keyword score: title hit 3, tag hit 2, body hit 1, per distinct query word. */
export function searchKb(query: string, limit = 3) {
  const q = [...new Set(words(query))];
  return articles
    .map((a) => {
      const title = new Set(words(a.title));
      const tags = new Set(a.tags.flatMap(words));
      const body = new Set(words(a.body));
      const score = q.reduce((s, w) => s + (title.has(w) ? 3 : 0) + (tags.has(w) ? 2 : 0) + (body.has(w) ? 1 : 0), 0);
      return { id: a.id, title: a.title, score, text: a.body };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
