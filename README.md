# Resolve

A ticket-resolution chatbot for support agents at a cloud accounting provider. A model (Claude, GPT or Gemini, your choice) looks up real (sample) data with tools, every tool call is shown, and a human approves every reply, refund, bug ticket or escalation before anything goes out.

- Next.js (App Router), TypeScript, Tailwind, `@anthropic-ai/sdk` tool use. No database, no login.
- Customers, tickets and the article source text live in typed JSON fixtures in `lib/data/` (3 customers, 12 KB articles, 8 tickets). Customer lookups read those files directly.
- `search_kb` is RAG: the query is embedded with `gte-small` (a Supabase Edge Function) and the closest articles are found by cosine similarity in Postgres with `pgvector`. The sample "today" is frozen at 2026-11-10 so refund-window checks are repeatable.
- Pick a provider (Anthropic, OpenAI or Google), a model, and paste your own API key for that provider. Keys stay in `sessionStorage` (one per provider), go to the backend as an `x-api-key` header, and are never saved or logged. Choose "Other model id" to type any model id the provider accepts.
- Anthropic uses `@anthropic-ai/sdk` (tool use). OpenAI (Chat Completions) and Gemini (`generateContent`) function calling are plain `fetch` calls in `lib/providers/`. All three share one agent loop, the same seven tools and the same validators. `OPENAI_BASE_URL` and `GEMINI_BASE_URL` can override the API endpoints.

```bash
npm install
npm run dev   # http://localhost:3000
```

## Knowledge-base setup (Supabase)

1. Add the Supabase integration from the Vercel Marketplace (or create a Supabase project). The app reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; copy `.env.example` to `.env.local` for local use.
2. Run `supabase/migrations/001_kb_articles.sql` in the SQL editor (table, HNSW index, `match_kb_articles` function; row-level security is on, so only the service role can read it).
3. Deploy the embedding function: `supabase functions deploy embed`.
4. Seed the articles: `npm run seed:kb`. It embeds each article in `lib/data/articles.json`, upserts it, and removes rows no longer in the file. Re-run after editing the articles.

If Supabase is missing or fails, `search_kb` returns an error that says so; it does not fall back to made-up or keyword results. `KB_MIN_SIMILARITY` (optional) drops weak matches.

## How it works

`POST /api/resolve` runs the loop (max 8 rounds, 10 tool calls) and streams newline-delimited JSON events: `step`, `tool_start`, `tool_end`, `approval`, `answer`, `error`, `done`.

Seven tools: `route_ticket`, `search_kb`, `lookup_customer` (read) and `draft_reply`, `issue_refund`, `create_bug_ticket`, `escalate_to_human` (actions that only return `pending_approval`). Rules are enforced in plain code (`lib/validators.ts`), not the prompt:

- `draft_reply`: rejected for unknown KB ids, unredacted email/phone/card, or more than 120 words.
- `issue_refund`: rejected if the order is older than 30 days or the amount exceeds the refundable balance; over 200 USD returns `needs_human`.
- Rejections go back to the model with the reason, up to 3 tries per tool.
- Emails, phone and card numbers are redacted in every tool result (and tool arguments and the answer) before they reach the model or the screen.

## Layout

`app/page.tsx` chat · `components/` screen parts · `app/api/resolve/route.ts` the route · `lib/` tools, retrieval (`kb.ts`), validators, redactor, agent loop, stream reader, presets · `supabase/` migration and embedding function · `scripts/seed-kb.ts` · `lib/data/` fixtures · `evals/promptfooconfig.yaml` promptfoo cases (not run in CI).
