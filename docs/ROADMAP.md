# Roadmap & backlog

Working state of the build. Kept in the repo so the plan and the code stay in the
same place.

**Status legend:** ✅ done · 🚧 in progress · ⬜ planned · ✂️ deliberately cut

---

## Timebox

The assignment ran on a **240-minute portal timer**. That constraint drove nearly
every decision below — see [`ARCHITECTURE.md`](ARCHITECTURE.md) for the reasoning
and [`AI-WORKFLOW.md`](AI-WORKFLOW.md) for how AI tooling was used inside it.

---

## P0 — core product slice

| | Item |
| --- | --- |
| ✅ | Project scaffold, TypeScript, Tailwind, ESLint |
| ✅ | Data model: `User`, `Document`, `Share` |
| ✅ | Authorization as pure functions (`canRead` / `canWrite` / `canManage`) |
| ✅ | Unit tests for the access-control boundary |
| ✅ | Mocked auth with a signed, httpOnly session cookie |
| ✅ | Seeded demo accounts + fixture documents |
| ✅ | Create / rename / delete a document |
| ✅ | Rich text: bold, italic, underline, H1–H3, bulleted + numbered lists, quote, undo/redo |
| ✅ | Debounced autosave with a visible save state |
| ✅ | Persistence as ProseMirror JSON — formatting survives reload |
| ✅ | Share by email, with Viewer / Editor roles |
| ✅ | Revoke access |
| ✅ | Owned vs. shared shown as separate sections |
| ✅ | Read-only surface for viewers, enforced server-side |
| ✅ | Import `.txt`, `.md`, `.docx` as a new document |
| ✅ | Upload validation: type allowlist, 2 MB cap, empty-file and corrupt-file paths |
| ✅ | 404 page, empty states, inline error messages |
| 🚧 | Deployment |
| 🚧 | README, architecture note, AI workflow note |

## P1 — quality of life

| | Item |
| --- | --- |
| ✅ | "Edited 4 minutes ago by Priya" attribution |
| ✅ | Warn before leaving with unsaved changes |
| ✅ | Keyboard-accessible toolbar with `aria-pressed` state |
| ✅ | `prefers-reduced-motion` respected |
| ⬜ | Optimistic UI on share/revoke |
| ⬜ | Toasts instead of inline error text |

## P2 — AI surface

| | Item |
| --- | --- |
| ✅ | "Summarise this document" via Gemini |
| ✅ | Degrades to hidden when no API key is configured |
| ✅ | Loading skeleton, error path, truncation notice |
| ⬜ | Streamed response rather than a single block |
| ⬜ | "Rewrite selection" / "continue writing" |
| ⬜ | Per-user rate limiting |

## P3 — next 2–4 hours, in priority order

1. **Integration tests over the route handlers.** The unit tests cover the
   authorization *rules*; they don't prove every route calls them. A handful of
   supertest-style tests against a test database would close that gap, and it is
   the single highest-value thing left.
2. **Export to Markdown / PDF.** ProseMirror JSON → Markdown is mechanical.
3. **Optimistic concurrency.** Two editors on one document currently
   last-write-wins. An `updatedAt` precondition on `PATCH` would at least *detect*
   the conflict and warn, which is honest without pretending to be a CRDT.
4. **Document search** across title and flattened body text.
5. **Share by link** with an expiring token.
6. **Real auth.** Everything routes through `getCurrentUser()`, so this is one
   file plus a provider.

---

## ✂️ Deliberately cut — and why

These were considered and rejected, not forgotten.

| Cut | Why |
| --- | --- |
| **Real-time collaborative editing (CRDT/OT)** | The brief asks for *sharing*; real-time appears once, under optional stretch, and only as "collaboration indicators". Doing it properly means Yjs, a persistence layer, awareness and a socket server — days, not hours. A multiplayer editor that drops characters is worse than an honest single-writer model. |
| **Real authentication** | Explicitly permitted to mock. Passwords, verification and a signup flow would have cost ~45 minutes, scored nothing, and made the sharing flow *harder* for a reviewer to exercise. |
| **File attachments** | Would need blob storage, signed URLs and a lifecycle policy. Import-as-document was the other option the brief offered, is more product-relevant, and needs none of that. |
| **Comments / suggestion mode** | A second document-shaped model (anchors, threads, resolution) on top of an unfinished first one. |
| **Version history** | Needs a snapshot or delta store and a diff UI. Real feature, real week. |
| **Images and tables in the editor** | Images reintroduce the blob storage that importing was chosen to avoid. |
| **Folders, tags, trash** | Organisation only matters past a few dozen documents. |
| **Mobile-optimised layout** | Responsive down to tablet; a phone-first editing surface is its own design problem. |
| **Dark mode** | Pure polish. |
