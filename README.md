# Resolve

A ticket-resolution chatbot for support agents at a cloud accounting provider. Claude looks up real (sample) data with tools, every tool call is shown, and a human approves every reply, refund, bug ticket or escalation before anything goes out.

- Next.js (App Router), TypeScript, Tailwind, `@anthropic-ai/sdk` tool use. No database, no login.
- Data lives in typed JSON fixtures in `lib/data/` (3 customers, 12 KB articles, 8 tickets). The sample "today" is frozen at 2026-11-10 so refund-window checks are repeatable.
- Paste your own Anthropic API key in the page. It stays in `sessionStorage`, goes to the backend as an `x-api-key` header, and is never saved or logged.

```bash
npm install
npm run dev   # http://localhost:3000
```

## How it works

`POST /api/resolve` runs the loop (max 8 rounds, 10 tool calls) and streams newline-delimited JSON events: `step`, `tool_start`, `tool_end`, `approval`, `answer`, `error`, `done`.

Seven tools: `route_ticket`, `search_kb`, `lookup_customer` (read) and `draft_reply`, `issue_refund`, `create_bug_ticket`, `escalate_to_human` (actions that only return `pending_approval`). Rules are enforced in plain code (`lib/validators.ts`), not the prompt:

- `draft_reply`: rejected for unknown KB ids, unredacted email/phone/card, or more than 120 words.
- `issue_refund`: rejected if the order is older than 30 days or the amount exceeds the refundable balance; over 200 USD returns `needs_human`.
- Rejections go back to Claude with the reason, up to 3 tries per tool.
- Emails, phone and card numbers are redacted in every tool result (and tool arguments and the answer) before they reach Claude or the screen.

## Layout

`app/page.tsx` chat · `components/` screen parts · `app/api/resolve/route.ts` the route · `lib/` tools, validators, redactor, agent loop, stream reader, presets · `lib/data/` fixtures · `evals/promptfooconfig.yaml` promptfoo cases (not run in CI).
