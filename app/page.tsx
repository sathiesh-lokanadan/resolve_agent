"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import LoginScreen from "@/components/LoginScreen";
import Workspace from "@/components/Workspace";
import { PROVIDERS } from "@/lib/types";

/** Signed-in name, `null` when signed out, `undefined` while we ask the server. */
export default function Page() {
  const [name, setName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { name?: string | null }) => live && setName(d.name ?? null))
      .catch(() => live && setName(null));
    return () => { live = false; };
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* the cookie expires on its own */
    }
    // The next person to sign in on this tab should not inherit the previous API keys.
    try {
      PROVIDERS.forEach((p) => sessionStorage.removeItem(`resolve.apiKey.${p}`));
    } catch {
      /* storage unavailable */
    }
    setName(null);
  }

  if (name === undefined)
    return <div className="flex min-h-dvh items-center justify-center text-neutral-400"><Loader2 className="animate-spin" /></div>;
  if (name === null) return <LoginScreen onSignedIn={setName} />;
  return <Workspace name={name} onLogout={logout} />;
}
