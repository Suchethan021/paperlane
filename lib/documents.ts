import { prisma } from "./db";
import { accessLevel, type AccessLevel } from "./authz";
import type { SessionUser } from "./auth";

/** Everything a page or route needs about one document plus the caller's rights. */
export type LoadedDocument = NonNullable<
  Awaited<ReturnType<typeof loadDocument>>
>;

const documentInclude = {
  owner: { select: { id: true, name: true, email: true, color: true } },
  lastEditedBy: { select: { id: true, name: true } },
  shares: {
    include: { user: { select: { id: true, name: true, email: true, color: true } } },
    orderBy: { createdAt: "asc" },
  },
} as const;

/**
 * Load a document *and* resolve access in one place.
 *
 * Returns null both when the document does not exist and when the caller has no
 * right to it. Callers turn that into a 404 either way — a 403 would confirm the
 * document exists, which is a small information leak on a URL people share.
 */
export async function loadDocument(
  id: string,
  user: SessionUser | null,
): Promise<
  | (Awaited<ReturnType<typeof findDocument>> & { level: Exclude<AccessLevel, "NONE"> })
  | null
> {
  if (!user) return null;

  const doc = await findDocument(id);
  if (!doc) return null;

  const level = accessLevel(user, {
    ownerId: doc.ownerId,
    shares: doc.shares.map((s) => ({ userId: s.userId, role: s.role })),
  });

  if (level === "NONE") return null;
  return { ...doc, level };
}

function findDocument(id: string) {
  return prisma.document.findUnique({ where: { id }, include: documentInclude });
}

/** The two lists the sidebar shows, in one round trip each. */
export async function listDocuments(userId: string) {
  const [owned, shared] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { name: true, color: true } },
        shares: { select: { id: true } },
      },
    }),
    prisma.document.findMany({
      where: { shares: { some: { userId } } },
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { name: true, color: true } },
        shares: { where: { userId }, select: { role: true } },
      },
    }),
  ]);

  return { owned, shared };
}
