# Architecture note

What I prioritized, what I traded away, and why. Written against a **240-minute**
timer, which is the constraint behind most of what follows.

---

## The one-paragraph version

The brief describes more product than fits in four hours, so the first decision
was which parts to make *real* and which to make *honest*. I made the
**authorization boundary** and the **editing round-trip** real — those are the two
places where a shortcut becomes a bug you can't talk your way out of. I made
**authentication** deliberately fake, and said so in the UI. Everything else was
sequenced so that a working, deployed application existed early and never stopped
existing.

---

## Priorities, in the order I committed to them

1. **A deployed URL before a finished feature.** Deployment is where four-hour
   builds die. A walking skeleton went up early so that every commit after it
   shipped, and there was never a moment with nothing to show.
2. **The access boundary over everything else.** A broken toolbar button is
   visible in one second. A broken share rule is silent, and the failure mode is
   "a stranger read a document". That asymmetry decided where the test budget went.
3. **A lossless editing round-trip.** "Save and reopen" is only worth anything if
   the formatting comes back exactly. That pushed the storage format decision.
4. **Honest edges.** Empty states, a real 404, file-type and size errors with
   readable messages. Cheap, and the difference between a demo and a product.
5. **One AI action, done properly**, rather than an AI surface everywhere.

---

## Shape

```
┌──────────────────────── Vercel — one deployable ─────────────────────────┐
│                                                                           │
│  app/documents            Server Components — lists, document shell       │
│  components/*             Client islands — editor, dialogs, switcher      │
│  app/api/*                Route Handlers — the HTTP API                   │
│                                                                           │
│  lib/auth.ts     getCurrentUser()   ← the swap-for-real seam              │
│  lib/authz.ts    canRead/Write/Manage ← pure, and what the tests target   │
│  lib/documents.ts loadDocument()    ← the only door to a document         │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ Prisma
                         ┌──────────▼──────────┐
                         │  Postgres (Neon)    │
                         └─────────────────────┘
```

Reads happen in Server Components — the document list and the document itself are
fetched on the server and streamed as HTML, so there is no loading spinner on
first paint and no client-side fetch waterfall. Writes go through Route Handlers,
because a write needs a status code, a validation error shape, and a client that
can react to failure.

---

## Decisions and trade-offs

### 1. One Next.js application, not a separate API service

**The challenge I put to this:** *is it still "full stack" if there's no separate
backend?* I decided yes, and the distinction matters. Route Handlers are a
backend — HTTP routing, session handling, authorization, database access, and
multipart file parsing all run server-side in Node. What I skipped is a *second
deployable*, not a layer.

My default stack is FastAPI + SQLAlchemy with a separate React frontend, and on a
longer brief I'd have reached for it. Against a four-hour timer it loses on
specifics rather than taste:

| | One Next.js app | FastAPI + separate React |
| --- | --- | --- |
| Deploy targets to get green | 1 | 2 |
| CORS configuration | none | required |
| Free-tier cold start | none | ~50s on common free tiers |
| Time to first deployed URL | ~10 min | ~40 min |

That cold-start row decided it. A reviewer clicking a link that appears dead for
the first minute concludes the app is broken, and "ship a testable build" is an
explicit evaluation criterion.

**The cost:** the backend is coupled to a Node runtime and to Vercel's model. If
this became a real product with a mobile client or a second consumer, the API
would want to be its own service. The seam is drawn — everything server-side lives
in `lib/` and `app/api/`, and nothing in `lib/` imports React.

### 2. Documents are stored as ProseMirror JSON, not HTML

The editor's native document model goes into a `Json` column verbatim.

Storing HTML instead would have been marginally simpler and is what I'd have
reached for by default. It also means every save is untrusted markup that has to
be sanitised on the way out, forever, and one missed path is stored XSS. JSON has
no such surface: it is structured data validated against a schema, and the editor
reconstructs the DOM from it.

**The cost:** the content is not queryable as text. Full-text search would need a
generated column holding a flattened copy. That's the trade I'd revisit first.

### 3. `Role` is an enum, not a lookup table

The instinct for a lookup table is that it "can be expanded without a migration".
Here that expandability is illusory. Roles are **behavioural** — the authorization
code has to branch on them, so adding `COMMENTER` means shipping code no matter
where the value is stored. A lookup table would buy an `INSERT` that does nothing
until a deploy catches up, at the cost of a join on every read and no compile-time
exhaustiveness.

The rule I applied: **who owns the value set — code, or data?** Code owns roles, so
they're an enum. If users owned them — tags, folders, departments — the answer
flips, because nothing branches on them.

And if roles ever *did* become customer-configurable, a role lookup table still
wouldn't be the answer; that's a permissions table with a role→permission join,
which is a different model entirely. So the lookup table isn't even on the
migration path.

### 4. Mocked auth is a product decision, not a shortcut

The brief permits seeded accounts. Rather than treat that as permission to be
lazy, I optimised it for the person evaluating it: a reviewer's job is to see a
document move between two people. Making them register two accounts in two
browsers to do that is worse for them and worth nothing.

So there's a one-click account switcher, labelled *(demo)* in the menu, and a line
on the sign-in screen stating plainly that auth is mocked.

**What is real:** the session is an HMAC-signed, httpOnly cookie. You cannot become
another user by editing `document.cookie`.
**What is fake:** there is no credential. Picking a name is enough.

Everything downstream calls `getCurrentUser()`. Replacing it is a change to
`lib/auth.ts` and nothing else.

### 5. Unreadable documents return `404`, never `403`

A `403` confirms the document exists. On a URL people paste into chat, that's a
small information leak — you learn your colleague has a document called
`acquisition-terms` even though you can't open it. `loadDocument()` returns `null`
for "doesn't exist" and "not yours" alike, and callers can't tell them apart.

### 6. Authorization is pure functions over plain data

`lib/authz.ts` has no imports. It takes a user shape and a document shape and
returns a decision.

That's what makes the test suite meaningful: 12 cases covering owner, editor,
viewer, stranger, signed-out, self-shared documents and prefix-collision user ids,
running in ~300 ms with no database, no HTTP and no mocks. It's also why there is
exactly one definition of "can this person see this" rather than a condition
copy-pasted across six route handlers.

**Known gap:** these tests prove the rules are right, not that every route calls
them. Integration tests over the handlers are the first thing in
[`ROADMAP.md`](ROADMAP.md).

### 7. Upload imports a document rather than attaching a file

Both were offered by the brief. Attachments need blob storage, signed URLs and a
lifecycle policy — a whole infrastructure dependency. Import needs none: the file
is parsed in the request handler, the resulting document is written to Postgres,
and the bytes are discarded. Same visible feature, one fewer service to run, and
it's the more product-relevant of the two.

`.md` goes through `marked`; `.docx` through `mammoth`; `.txt` through a small
paragraph splitter. All three converge on HTML and then on the same
`htmlToDoc()`, so the editor only ever receives content built from the extension
list it was configured with.

It's a Route Handler rather than a Server Action specifically because Server
Actions cap request bodies at 1 MB by default, which a `.docx` clears easily.

### 8. Concurrent editing is last-write-wins, and labelled as such

Two people editing simultaneously will overwrite each other. This is the largest
deliberate gap in the product and I'd rather name it than hide it.

Real-time co-editing means CRDTs or OT, a persistence layer for the shared
document, awareness/presence, and a socket server. That's days of work, and a
half-built version that drops characters is materially worse than an honest
single-writer model. The brief asks for *sharing*; real-time appears once, under
optional stretch, and only as "collaboration indicators".

What's there instead: debounced autosave, a visible save state, and
"edited 4 minutes ago by Priya" so you can at least see someone else was here.
The cheap next step is an `updatedAt` precondition on `PATCH` so a conflict is
*detected* and surfaced, which is honest without pretending to be Google Docs.

### 9. The AI feature is one action, not a surface

"Summarise this document" reads the open document and returns prose. No chat, no
agent, no prompt box.

It's gated on `GEMINI_API_KEY`: unset, the endpoint returns `503` and the button
never renders, so a local clone without a key still runs everything else. The key
is server-side, so reviewers can use the feature on the deployed app without
supplying one — the brief says reviewers must not have to pay for a service.

Temperature is 0.2 and input is capped at 24k characters to bound cost and
variance, and the panel says summaries can be wrong. An AI feature that doesn't
admit that is a worse feature.

---

## Data model

Three tables. Ownership is a **column** on `Document`; every additional grant is a
**row** in `Share`. That split means "who owns this" is always present and
unambiguous, while "who else can see it" grows without touching the document.

`@@unique([documentId, userId])` makes re-sharing an upsert that changes the role,
rather than stacking duplicate grants. Shares cascade on document delete.

---

## Security posture

- Every document route resolves access through `loadDocument()`. There is no
  endpoint that returns a document without an access check.
- The UI hides what you can't do; the **server refuses it regardless**. A viewer
  sees no toolbar *and* gets `403` from `PATCH`.
- Uploads are validated by extension allowlist (browsers report `.md` MIME types
  inconsistently, so the declared type isn't trusted), capped at 2 MB, and rejected
  when empty or unparseable.
- Every mutating route parses its body through a Zod schema before it reaches
  Prisma.
- Session cookies are httpOnly, `sameSite=lax`, `secure` in production, and signed.
- No secrets in the repo; `.env.example` documents what's needed.

---

## What I would change with more time

1. **Integration tests over the routes** — the known gap above.
2. **Conflict detection** on concurrent edits.
3. **A flattened-text column** to make search possible without giving up JSON.
4. **Streamed summaries** — a 3-second wait with a skeleton is fine; streaming is
   better.
5. **Real auth**, which is one file.
