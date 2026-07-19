"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";

interface PickableUser {
  id: string;
  name: string;
  email: string;
  color: string;
  owned: number;
  shared: number;
}

/** "Owns 2 · shared with them 1" — tells a reviewer who's worth signing in as. */
function accessHint(user: PickableUser): string {
  const parts: string[] = [];
  if (user.owned) parts.push(`owns ${user.owned}`);
  if (user.shared) parts.push(`${user.shared} shared with them`);
  return parts.length ? parts.join(" · ") : "no documents — nothing shared";
}

export function UserPicker({ users }: { users: PickableUser[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(user: PickableUser) {
    setBusyId(user.id);
    setError(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not sign in.");
        setBusyId(null);
        return;
      }

      startTransition(() => {
        router.replace("/documents");
        router.refresh();
      });
    } catch {
      setError("Network error — is the server running?");
      setBusyId(null);
    }
  }

  return (
    <div>
      <ul className="stagger space-y-0.5">
        {users.map((user) => {
          const busy = busyId === user.id;
          return (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => choose(user)}
                disabled={busyId !== null || pending}
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-ink-50 disabled:cursor-wait disabled:opacity-60"
              >
                <Avatar
                  name={user.name}
                  color={user.color}
                  size="lg"
                  className="ring-2 ring-white transition group-hover:scale-105"
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-ink-400">
                    {accessHint(user)}
                  </span>
                </span>

                {busy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-accent" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
