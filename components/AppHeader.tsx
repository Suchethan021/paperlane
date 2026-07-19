"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, LogOut } from "lucide-react";
import { Avatar } from "./Avatar";

interface Person {
  id: string;
  name: string;
  email: string;
  color: string;
}

/**
 * The account switcher is a demo affordance, not a product feature — it exists so
 * a reviewer can watch a document move between two people without juggling two
 * browsers. It is labelled as such in the menu.
 */
export function AppHeader({
  user,
  users,
  children,
}: {
  user: Person;
  users: Person[];
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function switchTo(id: string) {
    setBusy(true);
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    setOpen(false);
    setBusy(false);
    // Always land on the list: the document you were reading may not be shared
    // with the person you just became.
    router.push("/documents");
    router.refresh();
  }

  async function signOut() {
    setBusy(true);
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/documents"
          className="group flex items-center gap-2"
          aria-label="Paperlane home"
        >
          <span className="brand-mark flex h-7 w-7 items-center justify-center rounded-lg transition group-hover:scale-105">
            <FileText className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-ink-900 sm:block">
            Paperlane
          </span>
        </Link>

        <div className="min-w-0 flex-1">{children}</div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-ink-100"
          >
            <Avatar name={user.name} color={user.color} />
            <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
          </button>

          {open && (
            <div
              role="menu"
              className="surface-raised absolute right-0 mt-2 w-72 origin-top-right rounded-xl p-1.5 rise-in"
            >
              <div className="px-2.5 py-2">
                <p className="text-sm font-medium text-ink-900">{user.name}</p>
                <p className="truncate text-xs text-ink-500">{user.email}</p>
              </div>

              <div className="my-1 border-t border-ink-100" />

              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Switch account (demo)
              </p>

              {users
                .filter((u) => u.id !== user.id)
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => switchTo(u.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-ink-50 disabled:opacity-50"
                  >
                    <Avatar name={u.name} color={u.color} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-800">
                        {u.name}
                      </span>
                    </span>
                  </button>
                ))}

              <div className="my-1 border-t border-ink-100" />

              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={signOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4 text-ink-400" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
