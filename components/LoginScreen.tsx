"use client";
import { useState } from "react";
import { KeyRound, Loader2, UserRound } from "lucide-react";

export default function LoginScreen({ onSignedIn }: { onSignedIn: (name: string) => void }) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, token }),
      });
      const data = (await res.json().catch(() => ({}))) as { name?: string; error?: string };
      if (!res.ok || !data.name) setError(data.error ?? "Could not sign in. Try again.");
      else onSignedIn(data.name);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = "flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2.5 focus-within:border-black/30";
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/aplus_logo.svg" alt="A+ logo" width={56} height={56} className="h-14 w-14" />
          <div className="text-xs text-neutral-500">Accounting and Bookkeeping</div>
          <h1 className="text-xl font-semibold tracking-tight">Resolve - Support co-pilot</h1>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="text-neutral-600">Full name</span>
          <span className={field}>
            <UserRound size={15} className="shrink-0 text-neutral-500" />
            <input
              autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
              placeholder="e.g. Jane Smith" maxLength={60}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
            />
          </span>
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-neutral-600">Access token</span>
          <span className={field}>
            <KeyRound size={15} className="shrink-0 text-neutral-500" />
            <input
              type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off"
              placeholder="Shared access token"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
            />
          </span>
        </label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        <button disabled={busy || !name.trim() || !token.trim()} className="pill-dark flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-30">
          {busy && <Loader2 size={14} className="animate-spin" />} Sign in
        </button>
      </form>
    </main>
  );
}
