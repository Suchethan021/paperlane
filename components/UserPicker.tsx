"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "./Avatar";

interface PickableUser {
  id: string;
  name: string;
  email: string;
  color: string;
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
      <ul className="divide-y divide-ink-100">
        {users.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onClick={() => choose(user)}
              disabled={busyId !== null || pending}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-ink-50 disabled:opacity-50"
            >
              <Avatar name={user.name} color={user.color} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-ink-500">
                  {user.email}
                </span>
              </span>
              {busyId === user.id && (
                <span className="text-xs text-ink-400">Signing in…</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
