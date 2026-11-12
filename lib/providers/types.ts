import type { Turn } from "../types";

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolReply {
  call: ToolCall;
  content: string;
  isError: boolean;
}

export interface Completion {
  text: string;
  calls: ToolCall[];
  /** Set when the provider declined or returned nothing usable. */
  refused?: string;
}

/** One conversation with one provider. It keeps its own history in that provider's format. */
export interface ProviderSession {
  /** Name shown in the step list, for example "Asking Claude". */
  label: string;
  complete(allowTools: boolean): Promise<Completion>;
  addToolResults(replies: ToolReply[]): void;
}

export interface SessionOptions {
  apiKey: string;
  model: string;
  turns: Turn[];
  signal?: AbortSignal;
}

export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly retryAfterMs: number;
  constructor(message: string, readonly status?: number, opts: { retryable?: boolean; retryAfterMs?: number } = {}) {
    super(message);
    this.retryable = opts.retryable ?? false;
    this.retryAfterMs = opts.retryAfterMs ?? 0;
  }
}
