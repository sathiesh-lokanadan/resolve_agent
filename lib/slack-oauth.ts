import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

/** Slack's hosted MCP server uses OAuth 2.0. The app connects once; the token is kept in Supabase so every server instance can use it. */
export const SLACK_MCP_URL = process.env.SLACK_MCP_URL?.trim() || "https://mcp.slack.com/mcp";

export class SlackNotConnected extends Error {
  name = "SlackNotConnected";
  constructor() {
    super("Slack is not connected (or the connection expired). Sign in, then open /api/slack/connect to connect it.");
  }
}

export interface OAuthRow {
  tokens?: OAuthTokens | null;
  state?: string | null;
  code_verifier?: string | null;
}
export interface OAuthStore {
  load(): Promise<OAuthRow>;
  save(patch: OAuthRow): Promise<void>;
}

function supabase() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY), so the Slack token cannot be stored.");
  return { url: `${url}/rest/v1/slack_oauth`, headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" } };
}

export const supabaseStore = (): OAuthStore => ({
  async load() {
    const { url, headers } = supabase();
    const res = await fetch(`${url}?id=eq.default&select=tokens,state,code_verifier`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Could not read the Slack connection (Supabase HTTP ${res.status}).`);
    return ((await res.json()) as OAuthRow[])[0] ?? {};
  },
  async save(patch) {
    const { url, headers } = supabase();
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: "default", ...patch, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Could not save the Slack connection (Supabase HTTP ${res.status}).`);
  },
});

/** The MCP SDK's OAuth hooks. With `interactive` false (a normal post) it never starts a login: it reports "not connected". */
export class SlackAuthProvider implements OAuthClientProvider {
  authorizationUrl?: URL;
  constructor(
    private store: OAuthStore,
    readonly redirectUrl: string,
    private interactive: boolean,
    private creds = { id: process.env.SLACK_CLIENT_ID?.trim() ?? "", secret: process.env.SLACK_CLIENT_SECRET?.trim() || undefined },
  ) {}

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "Resolve",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.creds.secret ? "client_secret_post" : "none",
    };
  }
  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.creds.id ? { client_id: this.creds.id, ...(this.creds.secret ? { client_secret: this.creds.secret } : {}) } : undefined;
  }
  async tokens() {
    return (await this.store.load()).tokens ?? undefined;
  }
  async saveTokens(tokens: OAuthTokens) {
    await this.store.save({ tokens, state: null, code_verifier: null });
  }
  async state() {
    const state = crypto.randomUUID();
    await this.store.save({ state });
    return state;
  }
  async saveCodeVerifier(v: string) {
    await this.store.save({ code_verifier: v });
  }
  async codeVerifier() {
    const v = (await this.store.load()).code_verifier;
    if (!v) throw new Error("The Slack connect flow expired. Start again at /api/slack/connect.");
    return v;
  }
  redirectToAuthorization(url: URL) {
    if (!this.interactive) throw new SlackNotConnected();
    this.authorizationUrl = url;
  }
}
