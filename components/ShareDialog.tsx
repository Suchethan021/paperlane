"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "./Avatar";

export interface ShareEntry {
  role: "VIEWER" | "EDITOR";
  user: { id: string; name: string; email: string; color: string };
}

interface Person {
  id: string;
  name: string;
  email: string;
  color: string;
}

export function ShareDialog({
  documentId,
  ownerId,
  shares,
  people,
  onClose,
}: {
  documentId: string;
  ownerId: string;
  shares: ShareEntry[];
  people: Person[];
  onClose: () => void;
}) {
  const [list, setList] = useState<ShareEntry[]>(shares);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VIEWER" | "EDITOR">("EDITOR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  // Anyone not already the owner or a recipient.
  const candidates = people.filter(
    (p) => p.id !== ownerId && !list.some((s) => s.user.id === p.id),
  );

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not share.");

      setList((prev) => [
        ...prev.filter((s) => s.user.id !== body.user.id),
        { role: body.role, user: body.user },
      ]);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/share?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not remove access.");
      }
      setList((prev) => prev.filter((s) => s.user.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-5 shadow-xl rise-in"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="share-title" className="text-base font-semibold text-ink-900">
              Share document
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Editors can change the text. Viewers can only read it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={grant} className="flex gap-2">
          <input
            list="share-candidates"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@paperlane.example"
            className="min-w-0 flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <datalist id="share-candidates">
            {candidates.map((p) => (
              <option key={p.id} value={p.email}>
                {p.name}
              </option>
            ))}
          </datalist>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "VIEWER" | "EDITOR")}
            aria-label="Permission"
            className="rounded-lg border border-ink-300 px-2 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="EDITOR">Editor</option>
            <option value="VIEWER">Viewer</option>
          </select>

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            Share
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            People with access
          </p>

          {list.length === 0 ? (
            <p className="rounded-lg bg-ink-50 px-3 py-4 text-center text-xs text-ink-400">
              Only you. This document is private.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {list.map((s) => (
                <li key={s.user.id} className="flex items-center gap-2.5 py-2">
                  <Avatar name={s.user.name} color={s.user.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-800">
                      {s.user.name}
                    </span>
                    <span className="block truncate text-[11px] text-ink-400">
                      {s.user.email}
                    </span>
                  </span>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600">
                    {s.role === "VIEWER" ? "Viewer" : "Editor"}
                  </span>
                  <button
                    type="button"
                    onClick={() => revoke(s.user.id)}
                    disabled={busy}
                    className="rounded-md px-1.5 py-1 text-[11px] text-ink-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
