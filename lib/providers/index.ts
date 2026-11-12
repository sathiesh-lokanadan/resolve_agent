import type { Provider } from "../types";
import { anthropicSession, describeAnthropicError } from "./anthropic";
import { describeGoogleError, googleSession } from "./google";
import { describeOpenAiError, openaiSession } from "./openai";
import { ProviderError, type ProviderSession, type SessionOptions } from "./types";

export function createSession(provider: Provider, opts: SessionOptions): ProviderSession {
  if (provider === "openai") return openaiSession(opts);
  if (provider === "google") return googleSession(opts);
  return anthropicSession(opts);
}

/** A short, safe message for the page. The key is scrubbed from anything that is passed through. */
export function describeError(err: unknown, provider: Provider, apiKey: string): string {
  let msg: string | undefined;
  if (provider === "anthropic") msg = describeAnthropicError(err);
  else if (err instanceof ProviderError) msg = provider === "openai" ? describeOpenAiError(err) : describeGoogleError(err);
  // Only errors we know are safe to show pass through; anything else could carry internals.
  msg ??= err instanceof ProviderError || (err as { name?: string } | null)?.name?.endsWith("APIError") ? (err as Error).message : "Unexpected server error. Try again.";
  return msg.split(apiKey).join("[key]").slice(0, 400);
}
