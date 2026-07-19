"use client";

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Sparkles, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { editorExtensions } from "@/lib/tiptap";
import { TITLE_MAX } from "@/lib/validation";
import { EditorToolbar } from "./EditorToolbar";
import { ShareDialog, type ShareEntry } from "./ShareDialog";
import { SummaryPanel } from "./SummaryPanel";
import { RelativeTime } from "./RelativeTime";

type Level = "OWNER" | "EDITOR" | "VIEWER";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface Person {
  id: string;
  name: string;
  email: string;
  color: string;
}

const AUTOSAVE_DELAY = 900;

export function DocumentWorkspace({
  documentId,
  initialTitle,
  initialContent,
  level,
  owner,
  shares,
  people,
  updatedAt,
  lastEditedBy,
  aiEnabled,
}: {
  documentId: string;
  initialTitle: string;
  initialContent: JSONContent;
  level: Level;
  owner: Person;
  shares: ShareEntry[];
  people: Person[];
  updatedAt: string;
  lastEditedBy: string | null;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const canEdit = level !== "VIEWER";

  const [title, setTitle] = useState(initialTitle);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Held in a ref so the debounce timer always sends the newest values without
  // being re-created on every keystroke.
  const pending = useRef<{ title?: string; content?: JSONContent }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const payload = pending.current;
    pending.current = {};
    if (!payload.title && !payload.content) return;

    setState("saving");
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save.");
      }

      setState("saved");
      setError(null);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Could not save.");
      // Put the change back so the next attempt still carries it.
      pending.current = { ...payload, ...pending.current };
    }
  }, [documentId]);

  const queue = useCallback(
    (patch: { title?: string; content?: JSONContent }) => {
      pending.current = { ...pending.current, ...patch };
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY);
    },
    [flush],
  );

  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContent,
    editable: canEdit,
    // Required in the App Router: rendering the editor during SSR produces a
    // hydration mismatch because ProseMirror decorates the DOM on mount.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "min-h-[60vh] focus:outline-none",
        "data-placeholder": "Start writing…",
      },
    },
    onUpdate: ({ editor }) => queue({ content: editor.getJSON() }),
  });

  // Warn before losing an unsaved change to a refresh or a closed tab.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (state === "dirty" || state === "saving") e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function onTitleChange(value: string) {
    setTitle(value);
    if (value.trim()) queue({ title: value.trim() });
  }

  async function remove() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/documents");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not delete.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* ── Document bar ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/documents"
          className="flex items-center gap-1.5 text-sm text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Documents</span>
        </Link>

        <span className="ml-auto flex items-center gap-2">
          {aiEnabled && (
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Summarise
            </button>
          )}

          {level === "OWNER" && (
            <>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
              >
                <Users className="h-3.5 w-3.5" />
                Share
                {shares.length > 0 && (
                  <span className="rounded-full bg-white/25 px-1.5 text-[10px]">
                    {shares.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={remove}
                aria-label="Delete document"
                title="Delete document"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-300 bg-white text-ink-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </span>
      </div>

      {/* ── Read-only notice ─────────────────────────────────────────────── */}
      {!canEdit && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>
            You have <strong>view-only</strong> access. {owner.name} shared this
            with you.
          </span>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      {canEdit && editor && (
        <div className="sticky top-16 z-20 mb-4">
          <EditorToolbar editor={editor} />
        </div>
      )}

      {/* ── Paper ────────────────────────────────────────────────────────── */}
      <article className="paper rounded-2xl border border-ink-200 bg-white px-6 py-8 shadow-sm sm:px-12 sm:py-12">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => !title.trim() && setTitle(initialTitle)}
          disabled={!canEdit}
          maxLength={TITLE_MAX}
          aria-label="Document title"
          placeholder="Untitled document"
          className="mb-6 w-full border-none bg-transparent text-3xl font-bold tracking-tight text-ink-900 outline-none placeholder:text-ink-300 disabled:cursor-default"
        />
        <EditorContent editor={editor} />
      </article>

      {/* ── Status strip ─────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-ink-400">
        <SaveIndicator state={state} />
        <span>·</span>
        <span>
          Owner <strong className="font-medium text-ink-600">{owner.name}</strong>
        </span>
        <span>·</span>
        <span>
          Edited <RelativeTime value={updatedAt} />
          {lastEditedBy && ` by ${lastEditedBy}`}
        </span>
        {error && (
          <span role="alert" className="w-full text-red-600">
            {error}
          </span>
        )}
      </div>

      {shareOpen && (
        <ShareDialog
          documentId={documentId}
          ownerId={owner.id}
          shares={shares}
          people={people}
          onClose={() => {
            setShareOpen(false);
            router.refresh();
          }}
        />
      )}

      {summaryOpen && (
        <SummaryPanel
          documentId={documentId}
          title={title}
          onClose={() => setSummaryOpen(false)}
        />
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; className: string }> = {
    idle: { text: "All changes saved", className: "" },
    dirty: { text: "Unsaved changes…", className: "text-ink-500" },
    saving: { text: "Saving…", className: "text-ink-500" },
    saved: { text: "All changes saved", className: "text-emerald-600" },
    error: { text: "Not saved — retrying on next edit", className: "text-red-600" },
  };
  const { text, className } = map[state];
  return (
    <span aria-live="polite" className={className}>
      {text}
    </span>
  );
}
