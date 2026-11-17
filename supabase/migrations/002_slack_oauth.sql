-- One row holding the OAuth connection to the hosted Slack MCP server (see lib/slack-oauth.ts).
-- tokens: the access and refresh token. state / code_verifier: values that live only while the connect flow is open.
create table if not exists slack_oauth (
  id            text primary key default 'default',
  tokens        jsonb,
  state         text,
  code_verifier text,
  updated_at    timestamptz not null default now()
);

-- Only the server (service role) reads this table. With RLS on and no policies, the public anon key sees nothing.
alter table slack_oauth enable row level security;
