# AI workflow note

How AI tooling was actually used on this build, where it earned its keep, and —
more usefully — where its output was wrong and what I did instead.

---

## Tools

| Tool | Used for |
| --- | --- |
| **Claude Code** (CLI, in-terminal) | The main driver: scaffolding, implementation, refactors, reading unfamiliar docs, and reviewing my own decisions back at me. |
| **Google Gemini** (`gemini-2.5-flash`) | Not a build tool — it's *in* the product, powering the Summarise action. |

---

## Where AI materially sped up the work

**1. Reading the framework instead of guessing at it.**
The scaffold produced Next.js 16, which moved several APIs. Rather than write
code from memory and debug the fallout, I had the bundled v16 docs read first and
report only the deltas that touched what I was about to build. That surfaced the
single biggest trap up front — see the first rejection below — and turned what is
normally an hour of confusing type errors into a fact I knew before writing a line.

**2. Parallel research while implementation continued.**
Company and framework research ran as separate background tasks while I kept
writing code, rather than serialising them into the timeline. On a 240-minute
clock this is the difference between researching *or* building.

**3. The mechanical bulk.**
Prisma schema, Zod schemas, the toolbar's repetitive button markup, the seed
fixtures, Tailwind class strings. None of it is interesting; all of it is
time. This is where AI is genuinely near-free.

**4. Being argued with.**
Several decisions below started as me questioning a default and getting a
structured trade-off back rather than a yes. The enum-vs-lookup-table decision is
the clearest example — the useful output wasn't the answer, it was the framing
("who owns the value set — code or data?") that made the answer obvious and
reusable.

---

## What I changed or rejected

This is the part worth reading. Roughly in order of how much damage each would
have done.

### Pinned Prisma back a major version

`npm install` pulled **Prisma 7**, the current release. Prisma 7 changed the
generator name, requires an explicit output path, and moves the client import.
None of that is hard — but "not hard" and "not hard *inside a 240-minute timer on
an API I haven't used*" are different claims.

I pinned to **Prisma 6**, which I know cold. **Newest is not a virtue when the
budget is time.** The upgrade is a 20-minute task on a normal week and a
30%-chance-of-losing-an-hour task today.

### Distrusted every `params` example, including my own instinct

Practically every Next.js snippet in circulation — and my own muscle memory — uses
the pre-v16 pattern:

```ts
export async function GET(req, { params }: { params: { id: string } }) {
  const doc = await find(params.id)   // wrong in v16
}
```

In v16 the synchronous fallback for `params`, `searchParams`, `cookies()` and
`headers()` is **removed**. `params` is a Promise:

```ts
export async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

This is exactly the class of error where a model's training data is confidently
out of date. Checking it against the version actually installed cost five minutes
and saved a cascade.

### Rejected storing document content as HTML

The path of least resistance is `editor.getHTML()` into a text column. I stored
**ProseMirror JSON** instead.

HTML in a database is untrusted markup that must be sanitised on every read,
forever, and one missed path is stored XSS. JSON is structured data validated
against a schema that the editor reconstructs the DOM from — the sanitisation
question never arises. I accepted a real cost for it (content is no longer
queryable as text, so search would need a flattened column) and wrote that down
rather than discovering it later.

### Changed a `403` to a `404`

The natural generated shape for "you can't see this" is `403 Forbidden`. That
confirms the document exists. On a URL people paste into chat, that's an
information leak — you learn a colleague has a document called
`acquisition-terms` even though you can't open it.

`loadDocument()` now returns `null` for "doesn't exist" and "not yours" alike, and
callers cannot distinguish them.

### Rejected a Server Action for the file upload

Server Actions are the more idiomatic choice for a form in current Next, and were
the default suggestion. They also cap request bodies at **1 MB** by default, which
a `.docx` clears easily — and the failure would have shown up as a confusing
runtime error on the exact file type a reviewer is most likely to test.

Upload is a **Route Handler**, which has no such cap.

### Enum, not a lookup table, for `Role`

I pushed back on this one myself, because "a lookup table can be extended without
a migration" is the received wisdom.

It doesn't hold here. Roles are *behavioural* — the authorization code branches on
them — so adding `COMMENTER` means shipping code regardless of where the value
lives. The lookup table buys an `INSERT` that does nothing until a deploy catches
up, and charges a join on every read plus the loss of compile-time exhaustiveness.

The rule I took away: **who owns the value set, code or data?** Code owns roles →
enum. Users own tags or departments → lookup table.

### Caught two hydration bugs before they shipped

Both are the kind of thing that renders fine in dev and throws in the console:

- The TipTap editor needs `immediatelyRender: false` in the App Router.
  ProseMirror decorates the DOM on mount, so server-rendering it guarantees a
  mismatch.
- A naive `"3 minutes ago"` helper computed during SSR *always* mismatches,
  because the server and browser never share a clock tick. `RelativeTime` renders
  an absolute date on the server and swaps to relative after mount.

### Rewrote the framing of mocked auth

The first instinct — mine as much as anything — was to treat seeded accounts as a
confession. Reframing it as a decision made *for the reviewer* changed the design:
a one-click account switcher, labelled `(demo)`, so the sharing model can be
exercised in ten seconds instead of across two browsers. The scope cut got
smaller *and* the product got better, which is usually the sign the framing was
wrong to begin with.

---

## Where I deliberately didn't use AI

- **The scope decision.** What to build and what to cut is the actual assignment.
  That was mine, and it's in [`ROADMAP.md`](ROADMAP.md) and
  [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **The AI feature's own boundaries.** One action, not a chat surface. Adding more
  AI would have been easy and would have made the product worse.
- **Commit history.** Commits are hand-scoped so the history reads as a sequence
  of decisions rather than one bulk drop.

---

## How I verified

**Types.** `tsc --noEmit` clean, and ESLint clean, on every meaningful chunk. In a
codebase where the API boundary is typed end to end, a lot of would-be runtime
bugs surface here first.

**Tests.** `npm test` — 12 cases over the authorization rules, including two edge
cases I specifically went looking for because they're the ones a plausible-looking
implementation gets wrong: a document shared with its own owner must not demote
them, and user-id matching must not be prefix-based.

**The unhappy paths, by hand.** Not just the demo flow:

- signed out → document URL → redirected to sign-in
- signed in as a user with no access → `404`, not `403`
- viewer → no toolbar, and `PATCH` refused server-side
- editor → can edit, cannot delete or re-share
- upload a `.png` → rejected by type, with the accepted list shown
- upload an oversized file → rejected with actual sizes in the message
- upload an empty file → rejected
- summarise a near-empty document → refused with a reason, not a hallucinated summary
- unset `GEMINI_API_KEY` → button absent, rest of the app unaffected

**Formatting round-trip.** The specific thing "save and reopen" is worth nothing
without: apply every mark and block type, reload, confirm the document comes back
identical.

**Deployment as a checkpoint, not a final step.** Deployed early and kept it
deployed, so "works on my machine" was never load-bearing.

---

## Honest assessment

AI made this roughly a two-to-three-times faster build. It did not make the
decisions — and on the six occasions above, following its default would have
produced a worse product, a security weakness, or an hour lost to a version
mismatch.

The pattern I'd generalise: **AI is strongest where the answer is known and
tedious, and weakest exactly where the codebase is newer than its training data or
where the right answer depends on a constraint it can't see** — like a timer, or
who's going to review this and how much of their patience I get to spend.
