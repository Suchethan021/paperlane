/**
 * End-to-end verification against the running application.
 *
 *   npm run dev          # in one terminal
 *   npm run verify:e2e   # in another
 *
 * Unlike the Vitest suite (which unit-tests the authorization rules in
 * isolation), this drives real HTTP against a real database and covers the gap
 * those tests can't: that every route actually *calls* those rules. It needs a
 * running server and a seeded database, so it is not part of `npm test`.
 */
import assert from "node:assert";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
let pass = 0, fail = 0;

function check(label, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${extra}`); }
}

async function signIn(userId) {
  const r = await fetch(`${BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const raw = r.headers.getSetCookie?.() ?? [];
  const c = raw.map((s) => s.split(";")[0]).join("; ");
  return c;
}

const call = (cookie, path, init = {}) =>
  fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers || {}), cookie } });

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },
  orderBy: { createdAt: "asc" },
});
await prisma.$disconnect();

if (users.length < 4) {
  console.error("Seed the database first: npm run db:seed");
  process.exit(1);
}
const byName = (n) => users.find((u) => u.name.startsWith(n));

const S = byName("Suchethan"), P = byName("Priya"), M = byName("Marcus"), A = byName("Aisha");

console.log("\n── 1. Sessions ──");
const cs = await signIn(S.id), cp = await signIn(P.id), cm = await signIn(M.id), ca = await signIn(A.id);
check("signed in as four users", [cs, cp, cm, ca].every((c) => c.includes("paperlane_session")));

const forged = "paperlane_session=" + S.id + ".deadbeef";
const fr = await call(forged, "/api/documents");
check("forged cookie signature rejected (401)", fr.status === 401, `got ${fr.status}`);

console.log("\n── 2. Document lists ──");
const sl = await (await call(cs, "/api/documents")).json();
check("Suchethan owns 2", sl.owned.length === 2, `got ${sl.owned.length}`);
check("Suchethan shared-with-me 1", sl.shared.length === 1, `got ${sl.shared.length}`);

const al = await (await call(ca, "/api/documents")).json();
check("Aisha sees nothing", al.owned.length === 0 && al.shared.length === 0,
  `got ${al.owned.length}/${al.shared.length}`);

const welcome = sl.owned.find((d) => d.title === "Welcome to Paperlane");
check("welcome document found", Boolean(welcome));

console.log("\n── 3. Authorization boundary ──");
check("owner reads own doc (200)", (await call(cs, `/api/documents/${welcome.id}`)).status === 200);
check("editor (Priya) reads shared doc (200)", (await call(cp, `/api/documents/${welcome.id}`)).status === 200);
check("viewer (Marcus) reads shared doc (200)", (await call(cm, `/api/documents/${welcome.id}`)).status === 200);

const aiseeR = await call(ca, `/api/documents/${welcome.id}`);
check("stranger (Aisha) gets 404 not 403", aiseeR.status === 404, `got ${aiseeR.status}`);

const patchAsViewer = await call(cm, `/api/documents/${welcome.id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "hacked by viewer" }),
});
check("viewer PATCH refused (403)", patchAsViewer.status === 403, `got ${patchAsViewer.status}`);

const delAsEditor = await call(cp, `/api/documents/${welcome.id}`, { method: "DELETE" });
check("editor DELETE refused (403)", delAsEditor.status === 403, `got ${delAsEditor.status}`);

const shareAsEditor = await call(cp, `/api/documents/${welcome.id}/share`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "aisha@paperlane.example", role: "EDITOR" }),
});
check("editor cannot re-share (403)", shareAsEditor.status === 403, `got ${shareAsEditor.status}`);

console.log("\n── 4. Create, edit, persist ──");
const created = await (await call(cs, "/api/documents", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
})).json();
check("created document", Boolean(created.id));

// Every mark and block type the toolbar can produce, in one document.
const body = { type: "doc", content: [
  { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Round trip" }] },
  { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Deep heading" }] },
  { type: "paragraph", content: [
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
      { type: "text", text: " italic", marks: [{ type: "italic" }] },
      { type: "text", text: " underline", marks: [{ type: "underline" }] }] },
  { type: "bulletList", content: [{ type: "listItem", content: [
      { type: "paragraph", content: [{ type: "text", text: "bullet" }] }] }] },
  { type: "orderedList", content: [{ type: "listItem", content: [
      { type: "paragraph", content: [{ type: "text", text: "numbered" }] }] }] },
  { type: "blockquote", content: [
      { type: "paragraph", content: [{ type: "text", text: "quoted" }] }] },
]};
const patched = await call(cs, `/api/documents/${created.id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "Formatting test", content: body }),
});
check("patch accepted", patched.status === 200, `got ${patched.status}`);

const reread = await (await call(cs, `/api/documents/${created.id}`)).json();
check("title persisted", reread.title === "Formatting test");

// Deep equality, not string comparison: Postgres jsonb does not preserve key
// order, so serialising both sides and comparing strings reports a false failure
// on data that is semantically identical.
let roundTripped = true, roundTripErr = "";
try { assert.deepStrictEqual(reread.content, body); }
catch (e) { roundTripped = false; roundTripErr = e.message.slice(0, 160); }
check("every mark and block type round-trips losslessly", roundTripped, roundTripErr);

console.log("\n── 5. Validation ──");
const badTitle = await call(cs, `/api/documents/${created.id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "   " }),
});
check("blank title rejected (400)", badTitle.status === 400, `got ${badTitle.status}`);

const badJson = await call(cs, `/api/documents/${created.id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: "not json",
});
check("malformed JSON rejected (400)", badJson.status === 400, `got ${badJson.status}`);

const emptyPatch = await call(cs, `/api/documents/${created.id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}",
});
check("empty patch rejected (400)", emptyPatch.status === 400, `got ${emptyPatch.status}`);

console.log("\n── 6. Sharing ──");
const grant = await call(cs, `/api/documents/${created.id}/share`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "aisha@paperlane.example", role: "VIEWER" }),
});
check("owner grants viewer access (201)", grant.status === 201, `got ${grant.status}`);

const aiList = await (await call(ca, "/api/documents")).json();
check("Aisha now sees it under shared", aiList.shared.length === 1, `got ${aiList.shared.length}`);
check("shown as VIEWER", aiList.shared[0]?.shares?.[0]?.role === "VIEWER");

const upgrade = await call(cs, `/api/documents/${created.id}/share`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "aisha@paperlane.example", role: "EDITOR" }),
});
check("re-share upserts role (201)", upgrade.status === 201);
const aiList2 = await (await call(ca, "/api/documents")).json();
check("no duplicate grant created", aiList2.shared.length === 1, `got ${aiList2.shared.length}`);
check("role upgraded to EDITOR", aiList2.shared[0]?.shares?.[0]?.role === "EDITOR");

const noUser = await call(cs, `/api/documents/${created.id}/share`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "nobody@nowhere.com", role: "EDITOR" }),
});
check("sharing with unknown email 404s", noUser.status === 404, `got ${noUser.status}`);

const badEmail = await call(cs, `/api/documents/${created.id}/share`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "notanemail", role: "EDITOR" }),
});
check("invalid email rejected (400)", badEmail.status === 400, `got ${badEmail.status}`);

const revoke = await call(cs, `/api/documents/${created.id}/share?userId=${A.id}`, { method: "DELETE" });
check("owner revokes access", revoke.status === 200);
const aiList3 = await (await call(ca, "/api/documents")).json();
check("access actually gone", aiList3.shared.length === 0, `got ${aiList3.shared.length}`);

console.log("\n── 7. File import ──");
async function upload(cookie, name, content, type = "text/plain") {
  const fd = new FormData();
  fd.append("file", new Blob([content], { type }), name);
  return call(cookie, "/api/import", { method: "POST", body: fd });
}

const mdRes = await upload(cs, "quarterly-notes.md",
  "# Heading one\n\nSome **bold** text.\n\n- alpha\n- beta\n\n1. first\n2. second\n");
const md = await mdRes.json();
check("markdown import accepted (201)", mdRes.status === 201, `got ${mdRes.status}`);
check("title derived from filename", md.title === "quarterly notes", `got "${md.title}"`);

const mdDoc = await (await call(cs, `/api/documents/${md.id}`)).json();
const types = JSON.stringify(mdDoc.content);
check("heading preserved", types.includes('"heading"'));
check("bullet list preserved", types.includes('"bulletList"'));
check("ordered list preserved", types.includes('"orderedList"'));
check("bold mark preserved", types.includes('"bold"'));

const txtRes = await upload(cs, "plain.txt", "First para.\n\nSecond para.");
check("txt import accepted", txtRes.status === 201, `got ${txtRes.status}`);

const badType = await upload(cs, "photo.png", "\x89PNG\r\n", "image/png");
check("png rejected (415)", badType.status === 415, `got ${badType.status}`);

const empty = await upload(cs, "empty.txt", "");
check("empty file rejected (400)", empty.status === 400, `got ${empty.status}`);

const big = await upload(cs, "big.txt", "x".repeat(2 * 1024 * 1024 + 10));
check("oversized file rejected (413)", big.status === 413, `got ${big.status}`);

const anonImport = await fetch(`${BASE}/api/import`, { method: "POST", body: new FormData() });
check("import requires auth (401)", anonImport.status === 401, `got ${anonImport.status}`);

console.log("\n── 8. AI summary ──");
const thin = await call(cs, `/api/documents/${created.id}/summarize`, { method: "POST" });
check("thin document refused (422), not hallucinated", thin.status === 422, `got ${thin.status}`);

const sumRes = await call(cs, `/api/documents/${welcome.id}/summarize`, { method: "POST" });
const sum = await sumRes.json();
check("summary generated (200)", sumRes.status === 200, `got ${sumRes.status} ${JSON.stringify(sum).slice(0,120)}`);
check("summary is non-trivial", (sum.summary || "").length > 60);
if (sum.summary) console.log("    ↳ " + sum.summary.replace(/\n/g, " ").slice(0, 130) + "…");

const aiSummarize = await call(ca, `/api/documents/${welcome.id}/summarize`, { method: "POST" });
check("stranger cannot summarise (404)", aiSummarize.status === 404, `got ${aiSummarize.status}`);

console.log("\n── 9. Delete ──");
const del = await call(cs, `/api/documents/${created.id}`, { method: "DELETE" });
check("owner deletes", del.status === 200);
check("gone afterwards (404)", (await call(cs, `/api/documents/${created.id}`)).status === 404);

// tidy up imported fixtures
for (const id of [md.id, (await txtRes.json()).id]) {
  await call(cs, `/api/documents/${id}`, { method: "DELETE" });
}

console.log(`\n${"=".repeat(46)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(46));
process.exit(fail ? 1 : 0);
