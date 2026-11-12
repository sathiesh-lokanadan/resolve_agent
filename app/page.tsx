"use client";
import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Welcome from "@/components/Welcome";
import Thread from "@/components/Thread";
import LogPanel from "@/components/LogPanel";
import MessageBox from "@/components/MessageBox";
import { applyEvent, decide, patchMessage, streamResolve, toTurns } from "@/lib/stream";
import { useApiKey } from "@/lib/useApiKey";
import { DEFAULT_MODEL, MODELS, MODEL_ID_PATTERN, PROVIDER_INFO, PROVIDERS, type ApprovalState, type ChatMessage, type Provider } from "@/lib/types";

const uid = () => crypto.randomUUID();
const MODELS_HAS = (p: Provider, id: string) => MODELS[p].some((m) => m.id === id);

export default function Page() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKey, setApiKey] = useApiKey(provider);
  // The chosen model is remembered per provider, so switching back keeps your pick.
  const [models, setModels] = useState<Record<Provider, string>>({ ...DEFAULT_MODEL });
  const [customOn, setCustomOn] = useState<Record<Provider, boolean>>(() => Object.fromEntries(PROVIDERS.map((p) => [p, false])) as Record<Provider, boolean>);
  const model = models[provider];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /** Send the draft, or (for Retry) the text of the last question again with the failed answer removed. */
  async function send(retryText?: string) {
    const text = (retryText ?? draft).trim();
    if (!text || busy || !apiKey || !MODEL_ID_PATTERN.test(model)) return;
    const user: ChatMessage = { id: uid(), role: "user", text, steps: [], calls: [], status: "done" };
    const via = `${PROVIDER_INFO[provider].label} · ${model}`;
    const reply: ChatMessage = { id: uid(), role: "assistant", text: "", steps: [], calls: [], status: "working", via };
    // On retry, drop the failed question and answer first so the model sees the history once.
    const base = retryText !== undefined ? messages.slice(0, -2) : messages;
    const turns = [...toTurns(base), { role: "user" as const, content: text }];
    const ac = new AbortController();
    abort.current = ac;
    setMessages([...base, user, reply]);
    if (retryText === undefined) setDraft("");
    setBusy(true);
    const update = (fn: (m: ChatMessage) => ChatMessage) => setMessages((list) => patchMessage(list, reply.id, fn));
    try {
      await streamResolve({
        apiKey, provider, model, messages: turns, signal: ac.signal,
        onEvent: (e) => update((m) => applyEvent(m, e)),
      });
      update((m) => (m.status === "working" ? { ...m, status: "done" } : m));
    } catch (err) {
      const stopped = ac.signal.aborted;
      update((m) => ({ ...m, status: stopped ? "stopped" : "error", error: stopped ? undefined : (err as Error).message }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  function retry() {
    const last = messages[messages.length - 2];
    if (last?.role === "user") void send(last.text);
  }

  function onDecide(msgId: string, callId: string, a: ApprovalState) {
    setMessages((list) => patchMessage(list, msgId, (m) => decide(m, callId, a)));
  }

  function newChat() {
    abort.current?.abort();
    setMessages([]);
    setDraft("");
    setLogOpen(false);
  }

  const callCount = messages.reduce((n, m) => n + m.calls.length, 0);

  return (
    <div className="grid gap-3 p-3 lg:h-dvh lg:grid-cols-[256px_minmax(0,1fr)_360px] lg:overflow-hidden">
      <Sidebar
        provider={provider} onProvider={setProvider}
        model={model} onModel={(id) => setModels((m) => ({ ...m, [provider]: id }))}
        custom={customOn[provider] || !MODELS_HAS(provider, model)} onCustom={(on) => setCustomOn((c) => ({ ...c, [provider]: on }))}
        busy={busy} onNew={newChat}
        hasKey={!!apiKey} onSaveKey={setApiKey} onClearKey={() => setApiKey("")}
        callCount={callCount} onOpenLog={() => setLogOpen(true)}
      />

      <main className="flex min-w-0 flex-col lg:min-h-0">
        <div className="flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-1 py-4">
            {messages.length === 0 ? <Welcome onPick={setDraft} /> : <Thread messages={messages} onDecide={onDecide} onRetry={busy ? undefined : retry} />}
            <div ref={bottom} />
          </div>
        </div>
        <div className="sticky bottom-0 mx-auto w-full max-w-2xl bg-gradient-to-t from-paper via-paper/90 to-transparent pb-1 pt-4 lg:static lg:bg-none">
          <MessageBox
            value={draft} onChange={setDraft} onSend={() => send()} onStop={() => abort.current?.abort()}
            busy={busy} disabled={!apiKey || !MODEL_ID_PATTERN.test(model)}
            placeholder={!apiKey ? "Add your API key in the left panel to start" : !model ? "Enter a model id in the left panel" : "Paste a ticket or ask a follow-up…"}
          />
        </div>
      </main>

      {logOpen && <div className="fixed inset-0 z-20 bg-black/20 lg:hidden" onClick={() => setLogOpen(false)} />}
      <LogPanel messages={messages} open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
