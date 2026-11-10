"use client";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import ApiKeyBar from "@/components/ApiKeyBar";
import Welcome from "@/components/Welcome";
import Thread from "@/components/Thread";
import MessageBox from "@/components/MessageBox";
import { applyEvent, decide, patchMessage, streamResolve, toTurns } from "@/lib/stream";
import { useApiKey } from "@/lib/useApiKey";
import type { ApprovalState, ChatMessage, ModelId } from "@/lib/types";

const uid = () => crypto.randomUUID();

export default function Page() {
  const [apiKey, setApiKey] = useApiKey();
  const [model, setModel] = useState<ModelId>("claude-sonnet-5-5");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || busy || !apiKey) return;
    const user: ChatMessage = { id: uid(), role: "user", text, steps: [], calls: [], status: "done" };
    const reply: ChatMessage = { id: uid(), role: "assistant", text: "", steps: [], calls: [], status: "working" };
    const turns = [...toTurns(messages), { role: "user" as const, content: text }];
    const ac = new AbortController();
    abort.current = ac;
    setMessages((m) => [...m, user, reply]);
    setDraft("");
    setBusy(true);
    const update = (fn: (m: ChatMessage) => ChatMessage) => setMessages((list) => patchMessage(list, reply.id, fn));
    try {
      await streamResolve({
        apiKey, model, messages: turns, signal: ac.signal,
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

  function onDecide(msgId: string, callId: string, a: ApprovalState) {
    setMessages((list) => patchMessage(list, msgId, (m) => decide(m, callId, a)));
  }

  function newChat() {
    abort.current?.abort();
    setMessages([]);
    setDraft("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header model={model} onModel={setModel} onNew={newChat} busy={busy} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-6">
        {!apiKey && <div className="mb-6"><ApiKeyBar hasKey={false} onSave={setApiKey} onClear={() => setApiKey("")} /></div>}
        {messages.length === 0 ? <Welcome onPick={setDraft} /> : <Thread messages={messages} onDecide={onDecide} />}
        <div ref={bottom} />
      </main>
      <div className="sticky bottom-0 mx-auto w-full max-w-3xl space-y-2 bg-gradient-to-t from-paper via-paper/90 to-transparent px-4 pb-4 pt-6">
        <MessageBox
          value={draft} onChange={setDraft} onSend={send} onStop={() => abort.current?.abort()}
          busy={busy} disabled={!apiKey}
          placeholder={apiKey ? "Paste a ticket or ask a follow-up…" : "Add your API key above to start"}
        />
        {apiKey && <ApiKeyBar hasKey onSave={setApiKey} onClear={() => setApiKey("")} />}
      </div>
    </div>
  );
}
