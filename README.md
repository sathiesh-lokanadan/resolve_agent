# Resolve

A ticket-resolution chatbot for support agents at a cloud accounting provider. A model (Claude, GPT or Gemini, your choice) looks up real (sample) data with tools, every tool call is shown, and a human approves every reply, refund, bug ticket or escalation before anything goes out.

- Next.js (App Router), TypeScript, Tailwind, `@anthropic-ai/sdk` tool use. No database. Sign-in is a full name plus one shared access token.
- Customers, tickets and the article source text live in typed JSON fixtures in `lib/data/` (3 customers, 12 KB articles, 8 tickets). Customer lookups read those files directly.
- `search_kb` is RAG: the query is embedded with `gte-small` (a Supabase Edge Function) and the closest articles are found by cosine similarity in Postgres with `pgvector`. The sample "today" is frozen at 2026-11-10 so refund-window checks are repeatable.
- Pick a provider (Anthropic, OpenAI or Google), a model, and paste your own API key for that provider. Keys stay in `sessionStorage` (one per provider), go to the backend as an `x-api-key` header, and are never saved or logged. Choose "Other model id" to type any model id the provider accepts.
- Anthropic uses `@anthropic-ai/sdk` (tool use). OpenAI (Chat Completions) and Gemini (`generateContent`) function calling are plain `fetch` calls in `lib/providers/`. All three share one agent loop, the same seven tools and the same validators. `OPENAI_BASE_URL` and `GEMINI_BASE_URL` can override the API endpoints.

```bash
npm install
cp .env.example .env.local   # then set RESOLVE_ACCESS_TOKEN (and the Supabase values below)
npm run dev                  # http://localhost:3000
```

## Sign-in

Users enter their **full name** (shown in the header bar) and the **access token**, which is the same for everyone and is set with the `RESOLVE_ACCESS_TOKEN` environment variable (locally in `.env.local`, on Vercel under Project Settings > Environment Variables). If it is not set, nobody can sign in. A correct token sets a signed, httpOnly, 8-hour cookie; `/api/resolve` returns 401 without it, and Log out clears it and the API keys held in the tab. Changing the token signs everyone out. There is no rate limiting on the sign-in route.

## Knowledge-base setup (Supabase)

1. Add the Supabase integration from the Vercel Marketplace (or create a Supabase project). The app reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; copy `.env.example` to `.env.local` for local use.
2. Run `supabase/migrations/001_kb_articles.sql` in the SQL editor (table, HNSW index, `match_kb_articles` function; row-level security is on, so only the service role can read it).
3. Deploy the embedding function: `supabase functions deploy embed`.
4. Seed the articles: `npm run seed:kb`. It embeds each article in `lib/data/articles.json`, upserts it, and removes rows no longer in the file. Re-run after editing the articles.

If Supabase is missing or fails, `search_kb` returns an error that says so; it does not fall back to made-up or keyword results. `KB_MIN_SIMILARITY` (optional) drops weak matches.

## Slack updates (optional, write-only)

When a human approves or rejects an **`issue_refund`** proposal, the app can post one update to a Slack channel through a Slack MCP server. It never reads from Slack.

- The refund approval card has a **Post an update on slack** checkbox, ticked by default. Approving or rejecting with it ticked sends the post; unticking it sends nothing.
- Nothing is posted for how-tos, reply drafts, bug tickets or escalations, only for the human's decision on a refund. The Approve and Reject buttons on a refund wait until the agent has finished its summary, because the post includes it.
- The post has the customer query, the agent's case summary, the final decision (and who made it), the refund details (order, customer, amount, reason) and any bug ticket proposed in the same answer, with its `BUG-` id, severity, description and steps. A bug is labelled filed, proposed or rejected, depending on whether it has been approved yet.
- Text is redacted (email, phone, card and so on) and escaped for Slack before posting, so a ticket cannot ping `@channel`. If the post fails, the card shows the reason and a Retry button.

Setup. The app is an MCP client of Slack's hosted server (`https://mcp.slack.com/mcp`, OAuth 2.0); nothing is installed or spawned.

1. Use a Slack app that is internal or Marketplace-published, and ask a workspace admin to approve the MCP integration. Add `https://<your-host>/api/slack/callback` as a redirect URL.
2. Run `supabase/migrations/002_slack_oauth.sql` (one table that holds the OAuth token).
3. Set `SLACK_CLIENT_ID` and `SLACK_CHANNEL_ID` (see `.env.example`).
4. Once, sign in to Resolve and open `/api/slack/connect`. Slack asks you to approve; the token is saved in Supabase. Posts appear as the Slack user who connected, and any signed-in user can reconnect. If a post says Slack is not connected, repeat this step.

The server lists the MCP server's tools and uses its message-sending tool (for example `slack_send_message`), so tool names are not hard-coded; set `SLACK_MCP_TOOL` if several look alike. The token is stored unencrypted in a table only the service role can read. Bug ids (`BUG-1001`, ...) come from an in-memory counter, like approval ids, so they restart when the server does.

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
