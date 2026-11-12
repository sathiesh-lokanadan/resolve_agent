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

`app/page.tsx` chat · `components/` screen parts · `app/api/resolve/route.ts` the route · `lib/` tools, retrieval (`kb.ts`), validators, redactor, agent loop, stream reader, presets · `supabase/` migration and embedding function · `scripts/seed-kb.ts` · `lib/data/` fixtures · `tests/` Vitest unit tests and offline evals (run in CI) · `evals/` promptfoo live-model evals (manual).

## Evals, guardrails and failure handling

```bash
npm test               # 141 deterministic tests: units, agent loop, route, and 20 offline evals. No API key, no network.
npm run eval:offline   # only the offline evals (tests/evals.test.ts)
# Live-model evals (needs the app running, a key and the KB seeded):
npx promptfoo eval -c evals/promptfooconfig.yaml          # Anthropic
npx promptfoo eval -c evals/promptfooconfig.openai.yaml   # OpenAI
npx promptfoo eval -c evals/promptfooconfig.google.yaml   # Gemini
```

**Evals.** CI (`.github/workflows/ci.yml`) runs lint, typecheck, `npm test` and the build. The offline evals drive the real agent loop, tools, validators, redactor and output guard with a scripted model, including models that have been talked into doing the wrong thing (injected refund, invented citations, false "refund issued" claims). The 14 live cases in `evals/cases.yaml` are shared by all three providers, so each is scored the same way. The live cases have not been run in CI because they need API keys and a seeded Supabase.

**Input guardrails** (`lib/request.ts`, `lib/validators.ts`, `lib/tools.ts`): request shape, size caps (40 turns, 12k chars per turn, 60k total, 200 KB body), control characters removed, model id pattern; per-tool argument validation; refund window, balance, 200 USD cap that counts the running total of the request (splitting a refund does not get past it); duplicate refund proposals blocked; draft replies need real KB ids that `search_kb` returned in this conversation, no PII, at most 120 words; 3 tries per tool.

**Output guardrails** (`lib/output-guard.ts`, `lib/redact.ts`): citations of KB ids that were never retrieved are removed; an answer that claims a refund/reply/escalation already happened gets a visible notice (nothing is ever executed); a notice is added when the knowledge base was down and nothing was escalated; PII is redacted in tool args, tool results and the answer. Redaction covers email (including `name [at] host [dot] com`), card numbers, phone numbers, SSN, IBAN, and API keys or bearer tokens.

**Failure handling:** provider calls retry 429/5xx/dropped connections twice with exponential backoff and `Retry-After` (Anthropic via the SDK); KB calls retry once and sit behind a circuit breaker (3 failures, 30 s pause); every tool call has a 20 s timeout; provider failures after tools ran keep the partial tool log and offer a Retry button; empty answers, refusals, blocked prompts, malformed tool-call JSON and non-JSON provider replies become clear errors; the stream always ends with `done`, and the page reports a dropped, stalled or corrupt stream. Unexpected error text is never shown to the page and API keys are scrubbed from every message.

**Observability.** The server writes one JSON log line per event (`request_start`, `tool_call`, `guardrail_output`, `provider_retry`, `kb_breaker_open`, `request_end`...) with a request id (also in the `x-request-id` header). Logs hold metadata only: no ticket text, tool arguments, answers or keys. Set `RESOLVE_LOG=off` to silence them.

**Known limits.** Approvals are page state only; the server never sees them (the queue is simulated, nothing is sent). There is no per-IP rate limiting, and tickets are not screened for injection phrases (the defense is the prompt, the code-level validators and human approval). The ticket text itself is not redacted before the model sees it, because the model needs the customer email to look the customer up.
