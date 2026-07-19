# Submission — Paperlane

**Suchethan Kummajella** · AI-Native Full Stack Developer assignment
Built inside the portal's **240-minute** timer.

---

## Links

| | |
| --- | --- |
| **Live app** | https://paperlane-docs.vercel.app |
| **Source** | https://github.com/Suchethan021/paperlane |
| **Walkthrough video** | `<VIDEO_URL>` |
| **Drive folder** | `<DRIVE_URL>` |

### Sign in

No passwords — pick an account. Switch accounts from the avatar menu, top right.

| Account | Email | Why it exists |
| --- | --- | --- |
| Suchethan Kummajella | `suchethan@paperlane.example` | Owns the welcome doc + a private draft; **editor** on Priya's doc |
| Priya Raman | `priya@paperlane.example` | Owns *Q3 Product Review*; **editor** on the welcome doc |
| Marcus Lee | `marcus@paperlane.example` | **Viewer** on the welcome doc — read-only; owns a doc nobody else can see |
| Aisha Khan | `aisha@paperlane.example` | Access to **nothing** — proves documents don't leak |

**60-second tour:** sign in as **Suchethan** → open *Welcome to Paperlane* → edit,
watch it autosave → switch to **Priya**, it's under *Shared with me* and editable →
switch to **Marcus**, same doc but read-only with no toolbar → switch to **Aisha**,
it isn't in her list, and pasting its URL gives a **404, not a 403**.

---

## What's included

| File | What it is |
| --- | --- |
| `README.md` | Setup, run instructions, demo accounts, supported file types |
| `docs/ARCHITECTURE.md` | What I prioritized and why, with the trade-offs |
| `docs/AI-WORKFLOW.md` | AI tooling, and what I rejected from it |
| `docs/ROADMAP.md` | Backlog, and the deliberate cuts |
| `SUBMISSION.md` | This file |
| `scripts/verify-e2e.mjs` | End-to-end verification, 47 assertions |
| `tests/authz.test.ts` | Unit tests on the access-control rules |
| Source | Full application, in the repo and in the Drive folder |

---

## What works, end to end

- **Create, rename, edit, delete** documents.
- **Rich text** — bold, italic, underline, H1–H3, bulleted and numbered lists,
  block quotes, undo/redo.
- **Autosave**, debounced, with a visible save state and an unsaved-changes warning.
- **Persistence** as ProseMirror JSON — verified that every mark and block type
  survives a save/reload **losslessly**, by deep equality, not eyeballing.
- **Import** `.txt`, `.md` and `.docx` as new documents, with structure preserved.
  Limits stated in the UI and the README; wrong type, empty and oversized files
  each rejected with the right status and a readable message.
- **Sharing** by email with **Editor** / **Viewer** roles, plus revoke. Re-sharing
  upserts the role instead of stacking duplicate grants.
- **Owned vs shared** as separate sections, with owner and permission shown.
- **Authorization enforced server-side.** The UI hides what you can't do; the
  server refuses it regardless.
- **AI summary** of the open document, via Gemini.

---

## Scope decisions

The brief describes more product than fits in four hours, so the first decision was
which parts to make *real* and which to make *honest*. Full reasoning in
`docs/ARCHITECTURE.md`; the short version:

**Made real:** the authorization boundary and the editing round-trip. Both are
places where a shortcut becomes a bug you can't talk your way out of.

**Made deliberately fake, and labelled in the UI:** authentication.

**Cut on purpose:**

| Cut | Why |
| --- | --- |
| **Real-time co-editing (CRDT/OT)** | Not asked for — real-time appears once in the brief, under *optional* stretch, and only as "indicators". Doing it properly is Yjs + persistence + presence + a socket server. A multiplayer editor that drops characters is worse than an honest single-writer one. |
| **Real auth** | Explicitly permitted to mock. Would have cost ~45 min, scored nothing, and made the sharing flow *harder* to review. |
| **File attachments** | Needs blob storage, signed URLs, a lifecycle policy. Import-as-document was the other option offered, is more product-relevant, and needs none of it. |
| Comments, version history, images/tables, folders, PDF export | Each is a second product on top of an unfinished first one. |

**One judgment call worth naming:** I did build a small AI feature, because it's
one action with a real error path rather than an AI surface bolted on everywhere —
and because the role is explicitly AI-native. It's gated behind an env var and
degrades to hidden, so the app runs without it.

---

## What's incomplete

Stated plainly rather than hidden:

1. **Concurrent edits are last-write-wins.** Two people editing the same document
   at once will overwrite each other. There's no lock, no merge, no conflict
   warning. This is the largest deliberate gap.
2. **The end-to-end suite isn't in CI.** The coverage exists (47 assertions) but it
   needs a live server and a seeded database, so nothing automatically stops a
   regression landing.
3. **No full-text search.** Storing ProseMirror JSON bought safety and cost
   queryability; search would need a flattened text column.
4. **Mocked auth** — no credentials, no registration, no password reset.
5. **Responsive to tablet, not to phone.** The editor is usable on a small screen
   but not designed for it.
6. **`.docx` import drops images and complex styling.** The importer reports what
   it dropped rather than failing silently.

## With another 2–4 hours

In the order I'd actually do them:

1. **`verify:e2e` in GitHub Actions** against an ephemeral Postgres. The tests
   already exist; making them a gate is the highest-value hour left.
2. **Conflict detection** — an `updatedAt` precondition on `PATCH` so a concurrent
   edit is *detected* and surfaced. Honest without pretending to be Google Docs.
3. **Export to Markdown**, then PDF. ProseMirror JSON → Markdown is mechanical.
4. **A flattened-text column** to make search possible without giving up JSON.
5. **Streamed summaries** instead of a single block.
6. **Real auth** — one file, because everything already routes through
   `getCurrentUser()`.

---

## Running it locally

```bash
git clone https://github.com/Suchethan021/paperlane
cd paperlane
npm install
cp .env.example .env      # DATABASE_URL, SESSION_SECRET, optional GEMINI_API_KEY
npm run db:push
npm run db:seed
npm run dev
```

```bash
npm test              # unit — access-control rules
npm run verify:e2e    # end-to-end, needs the dev server running
```

Without `GEMINI_API_KEY` everything works except **Summarise**, which is hidden
rather than broken. No paid dependency or service is required.

---

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · TipTap · Prisma · PostgreSQL
(Neon) · Zod · Vitest · Gemini · deployed on Vercel.

One Next.js application rather than a separate API service — the reasoning,
including the "is that still full stack?" question, is in `docs/ARCHITECTURE.md`.
