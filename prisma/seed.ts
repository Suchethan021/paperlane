import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ── Small builders so the fixture content stays readable ─────────────────────

const t = (text: string, marks?: string[]) => ({
  type: "text",
  text,
  ...(marks ? { marks: marks.map((type) => ({ type })) } : {}),
});

const p = (...content: unknown[]) => ({ type: "paragraph", content });
const h = (level: number, text: string) => ({
  type: "heading",
  attrs: { level },
  content: [t(text)],
});
const li = (...content: unknown[]) => ({
  type: "listItem",
  content: [{ type: "paragraph", content }],
});
const ul = (...items: unknown[]) => ({ type: "bulletList", content: items });
const ol = (...items: unknown[]) => ({ type: "orderedList", content: items });
const doc = (...content: unknown[]) => ({ type: "doc", content }) as Prisma.InputJsonValue;

// ── Users ────────────────────────────────────────────────────────────────────

const USERS = [
  { key: "suchethan", name: "Suchethan Kummajella", email: "suchethan@paperlane.example", color: "#6366f1" },
  { key: "priya", name: "Priya Raman", email: "priya@paperlane.example", color: "#ec4899" },
  { key: "marcus", name: "Marcus Lee", email: "marcus@paperlane.example", color: "#f59e0b" },
  { key: "aisha", name: "Aisha Khan", email: "aisha@paperlane.example", color: "#10b981" },
] as const;

async function main() {
  const users: Record<string, { id: string }> = {};

  for (const u of USERS) {
    users[u.key] = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, color: u.color },
      create: { name: u.name, email: u.email, color: u.color },
      select: { id: true },
    });
  }

  // Re-seeding should produce the same fixture, not stack duplicates.
  await prisma.document.deleteMany({
    where: { title: { in: FIXTURES.map((f) => f.title) } },
  });

  for (const fixture of FIXTURES) {
    await prisma.document.create({
      data: {
        title: fixture.title,
        content: fixture.content,
        ownerId: users[fixture.owner].id,
        lastEditedById: users[fixture.owner].id,
        shares: {
          create: fixture.shares.map((s) => ({
            userId: users[s.with].id,
            role: s.role,
          })),
        },
      },
    });
  }

  console.log(`Seeded ${USERS.length} users and ${FIXTURES.length} documents.`);
}

// ── Fixture documents ────────────────────────────────────────────────────────

const FIXTURES: {
  title: string;
  owner: string;
  shares: { with: string; role: "VIEWER" | "EDITOR" }[];
  content: Prisma.InputJsonValue;
}[] = [
  {
    title: "Welcome to Paperlane",
    owner: "suchethan",
    shares: [
      { with: "priya", role: "EDITOR" },
      { with: "marcus", role: "VIEWER" },
    ],
    content: doc(
      h(1, "Welcome to Paperlane"),
      p(
        t("This document is owned by Suchethan and shared with two people at "),
        t("different permission levels", ["bold"]),
        t(" — which is the quickest way to see the access model work."),
      ),
      h(2, "Try this"),
      ol(
        li(t("Use the account switcher in the top right to sign in as "), t("Priya", ["bold"]), t(" — she has editor access and can change this text.")),
        li(t("Switch to "), t("Marcus", ["bold"]), t(" — he has viewer access, so the toolbar disappears and the document becomes read-only.")),
        li(t("Switch to "), t("Aisha", ["bold"]), t(" — this document is not shared with her, so it is not in her list at all.")),
      ),
      h(2, "Formatting"),
      p(
        t("The editor supports "),
        t("bold", ["bold"]),
        t(", "),
        t("italic", ["italic"]),
        t(", "),
        t("underline", ["underline"]),
        t(", headings, and both kinds of list."),
      ),
      ul(
        li(t("Bulleted lists like this one")),
        li(t("Numbered lists, as above")),
        li(t("Everything is stored as structured content, so formatting survives a reload")),
      ),
    ),
  },
  {
    title: "Q3 Product Review",
    owner: "priya",
    shares: [{ with: "suchethan", role: "EDITOR" }],
    content: doc(
      h(1, "Q3 Product Review"),
      p(t("Owned by Priya, shared with Suchethan as an editor. It appears under "), t("Shared with me", ["italic"]), t(" when signed in as Suchethan.")),
      h(2, "Agenda"),
      ol(
        li(t("Retention numbers")),
        li(t("Onboarding drop-off")),
        li(t("Roadmap for Q4")),
      ),
    ),
  },
  {
    title: "Engineering Onboarding",
    owner: "marcus",
    shares: [],
    content: doc(
      h(1, "Engineering Onboarding"),
      p(
        t("Owned by Marcus and shared with nobody. "),
        t("Only Marcus can open it", ["bold"]),
        t(" — requesting its URL as anyone else returns a 404 rather than a 403, so the app never confirms that a document you cannot read exists."),
      ),
    ),
  },
  {
    title: "Design System Notes",
    owner: "suchethan",
    shares: [],
    content: doc(
      h(1, "Design System Notes"),
      p(t("A private draft, to show the difference between owned-and-shared and owned-and-private.")),
      ul(li(t("Spacing scale")), li(t("Type ramp")), li(t("Colour tokens"))),
    ),
  },
];

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
