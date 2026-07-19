"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FilePlus2, Upload } from "lucide-react";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  humanSize,
  isAcceptedFile,
} from "@/lib/validation";

export function DocumentActions() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"new" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createBlank() {
    setBusy("new");
    setError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create document.");
      router.push(`/documents/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create document.");
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    // Check client-side for a fast message; the server checks again for real.
    if (!isAcceptedFile(file.name)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `That file is ${humanSize(file.size)} — the limit is ${humanSize(MAX_UPLOAD_BYTES)}.`,
      );
      return;
    }

    setBusy("import");
    setError(null);

    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: data });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed.");
      router.push(`/documents/${body.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // allow re-picking the same file
            if (file) void importFile(file);
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {busy === "import" ? "Importing…" : "Import file"}
        </button>

        <button
          type="button"
          onClick={createBlank}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <FilePlus2 className="h-4 w-4" />
          {busy === "new" ? "Creating…" : "New document"}
        </button>
      </div>

      <p className="text-[11px] text-ink-400">
        Imports {ACCEPTED_EXTENSIONS.join(", ")} up to {humanSize(MAX_UPLOAD_BYTES)}
      </p>

      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
