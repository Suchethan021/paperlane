# Paperlane

A lightweight collaborative document editor — create, format, import and share
documents, with a real ownership and permission model behind it.

Built as a timed take-home. The reasoning behind the scope lives in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the backlog and the deliberate
cuts are in [`docs/ROADMAP.md`](docs/ROADMAP.md).

> **Live demo:** _(see SUBMISSION.md)_

---

## What it does

- **Write.** Rich text with bold, italic, underline, three heading levels,
  bulleted and numbered lists, block quotes, and undo/redo.
- **Autosave.** Debounced, with a visible save state and a warning if you try to
  leave with something unsaved.
- **Import.** Drop a `.txt`, `.md` or `.docx` file and it becomes a new editable
  document with its structure intact.
- **Share.** Grant another account **Editor** or **Viewer** access by email.
  Viewers get a genuinely read-only surface — and the server refuses their writes
  even if they get past the UI.
- **Separate what's yours.** *Owned by me* and *Shared with me* are distinct
  sections, and shared documents show who owns them and what you can do.
- **Summarise.** One AI action, powered by Gemini, that summarises the open
  document. Optional — the app runs fine without an API key.

### Supported import formats

| Format | Handled by | Notes |
| --- | --- | --- |
| `.txt` | built-in | Blank lines become paragraph breaks. |
| `.md`, `.markdown` | `marked` | Headings, lists, emphasis, quotes, code. |
| `.docx` | `mammoth` | Text and structure. Images and complex styling are dropped, and the importer tells you when that happened. |

**Limit: 2 MB.** Anything else is rejected with a message naming the accepted
types. This is stated in the UI next to the import button as well as here.

---

## Demo accounts

Authentication is intentionally mocked — pick an account to sign in. No passwords.
Use the avatar menu (top right) to switch accounts in one click; that's the fastest
way to see sharing work.

| Account | Email | Set up so that… |
| --- | --- | --- |
| **Suchethan Kummajella** | `suchethan@paperlane.app` | owns *Welcome to Paperlane* and a private draft; has editor access to Priya's document |
| **Priya Raman** | `priya@paperlane.app` | owns *Q3 Product Review*; has **editor** access to the welcome doc |
| **Marcus Lee** | `marcus@paperlane.app` | has **viewer** access to the welcome doc — read-only; owns a document nobody else can see |
| **Aisha Khan** | `aisha@paperlane.app` | has access to **nothing** — useful for confirming documents don't leak |

### A 60-second tour

1. Sign in as **Suchethan** → open *Welcome to Paperlane* → edit it, watch it save.
2. Switch to **Priya** → the same document is under *Shared with me* → she can edit it.
3. Switch to **Marcus** → same document, but the toolbar is gone and it's read-only.
4. Switch to **Aisha** → the document isn't in her list. Paste its URL and you get
   a 404, not a 403 — the app never confirms a document you can't read exists.

---

## Running locally

### Requirements

- Node **20.9+** (built on 22)
- A PostgreSQL database — [Neon](https://neon.com)'s free tier needs no card

### Setup

```bash
git clone <repo-url>
cd paperlane
npm install

cp .env.example .env
#   DATABASE_URL    your Postgres connection string
#   SESSION_SECRET  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   GEMINI_API_KEY  optional — https://aistudio.google.com/apikey

npm run db:push     # create the tables
npm run db:seed     # create the four demo accounts and fixture documents
npm run dev
```

Open <http://localhost:3000>.

Without `GEMINI_API_KEY` everything works except the **Summarise** button, which
is hidden rather than broken.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm test` | Run the test suite |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:seed` | Seed demo accounts and documents (idempotent) |
| `npm run db:reset` | Drop, recreate and reseed |
| `npm run verify:e2e` | End-to-end check against a running server |
| `npm run lint` | ESLint |

---

## Tests

### Unit — the access rules

```bash
npm test
```

12 cases over `lib/authz.ts`. That's a deliberate choice about where limited test
budget goes: a broken button is visible immediately, whereas a broken permission
rule is silent and the failure mode is a document leaking to someone it was never
shared with.

They cover owner, editor, viewer, stranger and signed-out access, plus two edge
cases worth naming: a document shared with its own owner must not demote them,
and user-id matching must not be prefix-based.

Pure functions, so the suite needs no database, no HTTP server and no mocks, and
runs in about 300 ms.

### End-to-end — that the routes actually apply them

```bash
npm run dev          # one terminal
npm run verify:e2e   # another
```

47 assertions driving real HTTP against a seeded database. Unit tests prove the
rules are right; this proves every route *calls* them. It covers the unhappy
paths, not just the demo:

- a forged session cookie is rejected
- a stranger gets `404`, not `403`
- a viewer's `PATCH` is refused server-side even though the UI hides the toolbar
- an editor can neither delete nor re-share
- re-sharing upserts the role instead of creating a duplicate grant
- every mark and block type survives a save/reload **losslessly**
- `.png`, empty, and oversized uploads are each rejected with the right status
- a near-empty document is refused a summary rather than given a fabricated one

It needs a live server and a seeded database, so it isn't part of `npm test`.
Wiring it into CI against an ephemeral database is the top backlog item.

---

## Project structure

```
app/
  api/
    session/                 sign in, sign out
    documents/               list, create
    documents/[id]/          read, update, delete
    documents/[id]/share/    grant, revoke
    documents/[id]/summarize AI summary
    import/                  file → new document
  documents/                 list page, editor page
  login/                     account picker
components/                  editor, toolbar, dialogs, header
lib/
  auth.ts                    session — the swap-for-real seam
  authz.ts                   access rules — pure, tested
  documents.ts               the only door to a document
  tiptap.ts                  shared editor config, HTML → JSON
  validation.ts              Zod schemas, upload limits
prisma/                      schema + seed
tests/                       authorization suite
docs/                        architecture, AI workflow, roadmap
```

---

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · TipTap · Prisma · PostgreSQL
· Zod · Vitest · Gemini

Why a single Next.js app rather than a separate API service — including the
"is that still full stack?" question — is answered in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#1-one-nextjs-application-not-a-separate-api-service).
