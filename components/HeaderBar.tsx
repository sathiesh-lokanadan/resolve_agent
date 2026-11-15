import { LogOut } from "lucide-react";

export default function HeaderBar({ name, onLogout }: { name: string; onLogout: () => void }) {
  return (
    <header className="mx-3 mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-2.5 shadow-sm md:grid-cols-[1fr_auto_1fr]">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/aplus_logo.svg" alt="A+ logo" width={32} height={32} className="h-8 w-8 shrink-0" />
        <span className="truncate text-sm font-semibold tracking-tight max-sm:hidden">Accounting and Bookkeeping</span>
      </div>
      <h1 className="truncate text-center text-sm font-semibold tracking-tight">Resolve - Support co-pilot</h1>
      <div className="flex min-w-0 items-center justify-end gap-3 text-sm">
        <span className="truncate text-neutral-600" title={name}>{name}</span>
        <button onClick={onLogout} className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-xs hover:border-black/40">
          <LogOut size={13} /> Log out
        </button>
      </div>
    </header>
  );
}
